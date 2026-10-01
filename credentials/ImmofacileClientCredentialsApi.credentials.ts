import {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestHelper,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

const HOSTS: Record<string, string> = {
	production: 'https://v2.immo-facile.com',
	staging: 'https://ac3.staging.immo-facile.com',
};

// Expression used by the credential test, which cannot call the HOSTS map above.
const HOST_EXPRESSION =
	'={{$credentials.environment === "staging" ? "https://ac3.staging.immo-facile.com" : "https://v2.immo-facile.com"}}/api/v2/site';

export class ImmofacileClientCredentialsApi implements ICredentialType {
	name = 'immofacileClientCredentialsApi';
	displayName = 'Immofacile Client Credentials API';
	documentationUrl =
		'https://public.immo-facile.com/doc-api-v2/index.html#tag/Authentication/paths/~1api~1client~1token~1site/post';
	icon: Icon = { light: 'file:icons/immofacile.svg', dark: 'file:icons/immofacile.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{ name: 'Production', value: 'production' },
				{ name: 'Staging', value: 'staging' },
			],
			default: 'production',
			description:
				'Immofacile environment to talk to. Staging is an isolated demo environment, production is the live agency data',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'Client ID generated in the Immofacile admin dashboard',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Client secret generated alongside the client ID in the Immofacile admin dashboard',
		},
		{
			displayName: 'Scope',
			name: 'scopeType',
			type: 'options',
			options: [
				{ name: 'Site ID', value: 'site_id' },
				{ name: 'Agency ID (Manufacturer)', value: 'manufacturer_id' },
			],
			default: 'site_id',
			description:
				'How the token is scoped. A site groups one or more agencies, and the token reaches every agency of that site. Scoping by agency resolves its site',
		},
		{
			displayName: 'Scope ID',
			name: 'scopeId',
			type: 'string',
			default: '',
			required: true,
			description: 'Numeric ID of the site (or of the agency) the token is scoped to',
		},
		{
			// Filled in by preAuthentication. n8n finds the property to refresh by looking
			// for a hidden one marked `expirable`, so WITHOUT that flag preAuthentication is
			// never called at all: the Authorization header goes out as a bare "Bearer " and
			// every request, the credential test included, comes back 401.
			displayName: 'Session Token',
			name: 'sessionToken',
			type: 'hidden',
			typeOptions: { expirable: true, password: true },
			default: '',
		},
	];

	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const host = HOSTS[(credentials.environment as string) ?? 'production'] ?? HOSTS.production;

		// Trimmed: these are pasted by hand, and a trailing space or newline in the
		// secret produces a 401 that looks exactly like wrong credentials.
		const clientId = String(credentials.clientId ?? '').trim();
		const clientSecret = String(credentials.clientSecret ?? '').trim();
		const scopeId = String(credentials.scopeId ?? '').trim();
		const scopeType = String(credentials.scopeType ?? 'site_id');

		if (clientId === '' || clientSecret === '' || scopeId === '') {
			throw new Error(
				'Immofacile: Client ID, Client Secret and Scope ID are all required to obtain a token',
			);
		}

		const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

		// The token endpoint sits outside /api/v2/site, takes HTTP Basic auth and a
		// form-urlencoded body holding either site_id or manufacturer_id.
		const response = (await this.helpers.httpRequest({
			method: 'POST',
			url: `${host}/api/client/token/site`,
			headers: {
				Accept: 'application/json',
				Authorization: `Basic ${basic}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({ [scopeType]: scopeId }).toString(),
		})) as { access_token?: string } | string;

		// A 2xx that carries no token means the host answered something that is not the
		// token endpoint (a proxy or a login page, as the staging host does). Without
		// this check the empty token turns into an opaque 401 on the next request.
		const accessToken = typeof response === 'object' ? response.access_token : undefined;
		if (!accessToken) {
			throw new Error(
				`Immofacile: ${host}/api/client/token/site returned no access_token. Check the Environment: the staging host is not publicly reachable`,
			);
		}

		return { sessionToken: accessToken };
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Accept: 'application/json',
				Authorization: '=Bearer {{$credentials.sessionToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			baseURL: HOST_EXPRESSION,
			url: '/discovery',
		},
	};
}
