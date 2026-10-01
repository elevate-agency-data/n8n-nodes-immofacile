import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

// Expression used by the credential test, which cannot reach a lookup table.
const HOST_EXPRESSION =
	'={{$credentials.environment === "staging" ? "https://ac3.staging.immo-facile.com" : "https://v2.immo-facile.com"}}/api/v2/site';

export class ImmofacileApi implements ICredentialType {
	name = 'immofacileApi';
	displayName = 'Immofacile API';
	documentationUrl =
		'https://public.immo-facile.com/doc-api-v2/index.html#section/Welcome-to-the-Immofacile-API';
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
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Bearer token obtained from POST /api/client/token/site. Immofacile tokens expire, so prefer the Client Credentials credential, which refreshes the token on its own',
		},
	];

	// NOTE: Content-Type is deliberately NOT set here. The node performs multipart/form-data
	// uploads for the two product photo operations, and the HTTP layer must set that header
	// with its own boundary. Content-Type is set per request, only when a JSON body is present.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Accept: 'application/json',
				Authorization: '=Bearer {{$credentials.accessToken}}',
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
