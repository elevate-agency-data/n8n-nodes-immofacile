// Built from the Immofacile API V2 OpenAPI spec (1.2.0): 66 operations across 11 resources.
// https://api-immofacile.redocly.app/openapi

import {
	BINARY_ENCODING,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INode,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

// The API is reachable on two hosts. Which one is used comes from the credential,
// so both credential types carry the same Environment field.
const HOSTS: Record<string, string> = {
	production: 'https://v2.immo-facile.com',
	staging: 'https://ac3.staging.immo-facile.com',
};

const API_PREFIX = '/api/v2/site';

// Product photos: minimum width 800px, maximum 20 MB per file.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// Operations that send one file as multipart/form-data, mapped to their form field.
const UPLOAD_OPERATIONS: Record<string, string> = {
	addPrivatePhotoPost: 'file',
	addPublicPhotoPost: 'file',
};

export class Immofacile implements INodeType {
	description: INodeTypeDescription = {
		name: 'immofacile',
		displayName: 'Immofacile',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + " → " + $parameter["operation"]}}',
		description: 'Use the Immofacile API',
		defaults: { name: 'Immofacile' },
		icon: { light: 'file:immofacile.svg', dark: 'file:immofacile.dark.svg' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'immofacileApi',
				required: true,
				displayOptions: { show: { authentication: ['accessToken'] } },
			},
			{
				name: 'immofacileClientCredentialsApi',
				required: true,
				displayOptions: { show: { authentication: ['clientCredentials'] } },
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Client Credentials', value: 'clientCredentials' },
					{ name: 'Access Token', value: 'accessToken' },
				],
				default: 'clientCredentials',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				// The resource names are the tag names of the Immofacile API reference, so an
				// operation is found in the same place in the node and in the documentation.
				// Most of those tags are plural, which this rule would rewrite to a singular
				// of its own ("Criterias" to "Criterion", and so on).
				/* eslint-disable n8n-nodes-base/node-param-resource-with-plural-option */
				options: [
					{
						name: 'Agencies',
						value: 'agencies',
						description: 'Read the agencies the token has access to',
					},
					{
						name: 'Agenda',
						value: 'agenda',
						description: 'Calendar events, event types, permanences, working time and availability',
					},
					{
						name: 'Configs',
						value: 'configs',
						description: 'Read the values of the referential lists',
					},
					{
						name: 'Criterias',
						value: 'criterias',
						description: 'Discover the product and search-request criteria, zones and categories of the site',
					},
					{
						name: 'Customers',
						value: 'customers',
						description: 'Contacts: creation, search, follow-ups, search requests, actions and consent',
					},
					{
						name: 'Discovery',
						value: 'discovery',
						description: 'Discover the agencies and sites the token can reach',
					},
					{
						name: 'Leads',
						value: 'leads',
						description: 'Push seller and buyer leads into the CRM',
					},
					{
						name: 'Products',
						value: 'products',
						description: 'Property listings: creation, search, criteria, lots, photos and actions',
					},
					{
						name: 'Transactions',
						value: 'transactions',
						description: 'Sale agreements (compromis), sales offers (offres d\'achat) and leases',
					},
					{
						name: 'Users',
						value: 'users',
						description: 'Users (agents/collaborators) and the groups, types and genders they use',
					},
					{
						name: 'Webhooks',
						value: 'webhooks',
						description: 'Subscribe to real-time events by registering webhooks',
					},
				],
				/* eslint-enable n8n-nodes-base/node-param-resource-with-plural-option */
				default: 'agencies',
				required: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['agencies'] } },
				options: [
					{
						name: 'Get Agency Details',
						value: 'getAgencyGet',
						action: 'Get agency details',
						description: 'Returns detailed information about a specific agency, including its users',
					},
					{
						name: 'List Agencies',
						value: 'listAgenciesGet',
						action: 'List agencies',
						description: 'Returns all agencies accessible by the authenticated token with cursor-based pagination',
					},
				],
				default: 'getAgencyGet',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['agenda'] } },
				options: [
					{
						name: 'Change Event Status',
						value: 'changeEventStatusPatch',
						action: 'Change event status',
						description: 'Archives or restores an event',
					},
					{
						name: 'Create an Event',
						value: 'createEventPost',
						action: 'Create an event',
						description: 'Creates a calendar event. Exactly one participant must be flagged as is_organizer and exactly one as is_creator, and each participant must have a unique user_id.',
					},
					{
						name: 'Delete an Event',
						value: 'deleteEventDelete',
						action: 'Delete an event',
						description: 'Permanently deletes an event',
					},
					{
						name: 'Get an Event',
						value: 'getEventGet',
						action: 'Get an event',
						description: 'Returns a single event by ID',
					},
					{
						name: 'Get Permanence Timeframe',
						value: 'getPermanenceTimeframeGet',
						action: 'Get permanence timeframe',
						description: 'Returns the client reception (permanence) slots configured for an agency, grouped by day of week',
					},
					{
						name: 'Get User Availability',
						value: 'getUserAvailabilityGet',
						action: 'Get user availability',
						description: 'Returns the available slots of a user over a period, computed from their working time and existing events. Defaults to the current week when from/to are omitted.',
					},
					{
						name: 'Get User Working Time',
						value: 'getUserWorkingTimeGet',
						action: 'Get user working time',
						description: 'Returns the working time slots of a user for the current week, grouped by day',
					},
					{
						name: 'List Event Types',
						value: 'listEventTypesGet',
						action: 'List event types',
						description: 'Returns the agency configured event types with their display form (visible and collapsed fields). Cursor-based pagination.',
					},
					{
						name: 'List Permanence Users',
						value: 'listPermanenceUsersGet',
						action: 'List permanence users',
						description: 'Returns the users assigned to permanence slots over a period for an agency. Defaults to the current week when from/to are omitted.',
					},
					{
						name: 'List Shared Agendas',
						value: 'listSharedAgendasGet',
						action: 'List shared agendas',
						description: 'Returns the agendas accessible by the given user (users whose calendar is shared with them)',
					},
					{
						name: 'Search Events',
						value: 'searchEventsGet',
						action: 'Search events',
						description: 'Searches events over a period with optional filters. Defaults to the current day when from/to are omitted. Recurring events are expanded by default.',
					},
					{
						name: 'Update an Event',
						value: 'updateEventPatch',
						action: 'Update an event',
						description: 'Partially updates an event. When participants are provided, exactly one must be flagged is_organizer and exactly one is_creator, with unique user_id.',
					},
				],
				default: 'changeEventStatusPatch',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['configs'] } },
				options: [
					{
						name: 'Get List Values',
						value: 'getListValuesGet',
						action: 'Get list values',
						description: 'Returns all values for a given referential list (liste_id). Lists contain predefined values used in forms and validated fields.',
					},
					{
						name: 'List Action Types',
						value: 'listActionTypesGet',
						action: 'List action types',
						description: 'Returns the action types active for the site. This is where the action_id of Create an Action for a Product and Create an Action for a Customer comes from. Absent from the API reference, which nonetheless points to it from both of those pages.',
					},
				],
				default: 'getListValuesGet',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['criterias'] } },
				options: [
					{
						name: 'Get a Product Criteria by ID',
						value: 'getProductCriteriaByIdGet',
						action: 'Get a product criteria by ID',
						description: 'Returns a single product criteria definition with its possible values',
					},
					{
						name: 'Get All Product Criteria',
						value: 'getAllProductCriteriaGet',
						action: 'Get all product criteria',
						description: 'Returns all product criteria definitions for the site, including type, label, activation state and personalisation flags',
					},
					{
						name: 'Get Product Criteria Values',
						value: 'getProductCriteriaValuesGet',
						action: 'Get product criteria values',
						description: 'Returns the possible values of a UNIQUE or MULTIPLE product criteria. The value sent when writing a criterion must be the model field of one of these values, not its numeric ID. Returns an empty list for the other criteria types. Absent from the API reference, which nonetheless points to it from the Create a Product page.',
					},
					{
						name: 'Get Search Request Criteria',
						value: 'getSearchRequestCriteriaGet',
						action: 'Get search request criteria',
						description: 'Returns the criteria available for buyer search requests on this site',
					},
					{
						name: 'Get Zone List',
						value: 'getZoneListGet',
						action: 'Get zone list',
						description: 'Returns the list of geographic zones available for the site',
					},
				],
				default: 'getProductCriteriaByIdGet',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['customers'] } },
				options: [
					{
						name: 'Create a Customer',
						value: 'createCustomerPost',
						action: 'Create a customer',
						description: 'Creates a new customer',
					},
					{
						name: 'Create a Follow-Up',
						value: 'createFollowUpPost',
						action: 'Create a follow up',
						description: 'Creates a follow-up linking a customer to a product. Returns 409 if the follow-up already exists (customer already follows this product).',
					},
					{
						name: 'Create a Search Request',
						value: 'createSearchRequestPost',
						action: 'Create a search request',
						description: 'Creates a search request for a customer with criteria',
					},
					{
						name: 'Create an Action for a Customer',
						value: 'createCustomerActionPost',
						action: 'Create an action for a customer',
						description: 'Logs a new commercial action on a customer record',
					},
					{
						name: 'Create or Update Cold-Calling Consent',
						value: 'setColdCallingConsentPost',
						action: 'Create or update cold calling consent',
						description: 'Creates or updates the cold-calling consent (consentement anti-démarchage) for a customer',
					},
					{
						name: 'Delete a Follow-Up',
						value: 'deleteFollowUpDelete',
						action: 'Delete a follow up',
						description: 'Removes a follow-up between a customer and a product',
					},
					{
						name: 'Get a Customer',
						value: 'getCustomerGet',
						action: 'Get a customer',
						description: 'Returns detailed customer information',
					},
					{
						name: 'List Actions for a Customer',
						value: 'listCustomerActionsGet',
						action: 'List actions for a customer',
						description: 'Returns paginated action history for a customer',
					},
					{
						name: 'List Customer Groups',
						value: 'listCustomerGroupsGet',
						action: 'List customer groups',
						description: 'Returns all available customer groups for the site',
					},
					{
						name: 'List Customer Origins',
						value: 'listCustomerOriginsGet',
						action: 'List customer origins',
						description: 'Returns all available customer origins for the site',
					},
					{
						name: 'List Follow-Ups',
						value: 'listFollowUpsGet',
						action: 'List follow ups',
						description: 'Returns paginated follow-ups (rapprochements) for a customer',
					},
					{
						name: 'Revoke Cold-Calling Consent',
						value: 'revokeColdCallingConsentDelete',
						action: 'Revoke cold calling consent',
						description: 'Revokes the cold-calling consent for a customer',
					},
					{
						name: 'Search Customers',
						value: 'searchCustomersPost',
						action: 'Search customers',
						description: 'Searches customers with cursor-based pagination',
					},
					{
						name: 'Update a Customer',
						value: 'updateCustomerPatch',
						action: 'Update a customer',
						description: 'Partially updates a customer. Only provided fields are modified.',
					},
					{
						name: 'Update a Follow-Up',
						value: 'updateFollowUpPatch',
						action: 'Update a follow up',
						description: 'Updates a follow-up (e.g. rating)',
					},
					{
						name: 'Update a Search Request',
						value: 'updateSearchRequestPatch',
						action: 'Update a search request',
						description: 'Partially updates a search request for a customer',
					},
				],
				default: 'createCustomerPost',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['discovery'] } },
				options: [
					{
						name: 'Get Accessible Scope',
						value: 'getAccessibleScopeGet',
						action: 'Get accessible scope',
						description: 'Returns all agencies and sites accessible by the authenticated client',
					},
				],
				default: 'getAccessibleScopeGet',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['leads'] } },
				options: [
					{
						name: 'Create a Buyer Lead',
						value: 'createBuyerLeadPost',
						action: 'Create a buyer lead',
						description: 'Creates a buyer lead with a customer and optional search requests',
					},
					{
						name: 'Create a Seller Lead',
						value: 'createSellerLeadPost',
						action: 'Create a seller lead',
						description: 'Creates a seller lead with a customer and a product',
					},
				],
				default: 'createBuyerLeadPost',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['products'] } },
				options: [
					{
						name: 'Add a Private Photo',
						value: 'addPrivatePhotoPost',
						action: 'Add a private photo',
						description: 'Uploads a private photo for a product. Minimum width 800px, max 20MB.',
					},
					{
						name: 'Add a Public Photo',
						value: 'addPublicPhotoPost',
						action: 'Add a public photo',
						description: 'Uploads a public photo for a product. Minimum width 800px, max 20MB.',
					},
					{
						name: 'Create a Product',
						value: 'createProductPost',
						action: 'Create a product',
						description: 'Creates a new product (property listing)',
					},
					{
						name: 'Create an Action for a Product',
						value: 'createProductActionPost',
						action: 'Create an action for a product',
						description: 'Logs a new action on a product record',
					},
					{
						name: 'Get a Product',
						value: 'getProductGet',
						action: 'Get a product',
						description: 'Returns detailed information about a product',
					},
					{
						name: 'Get Product Lots',
						value: 'getProductLotsGet',
						action: 'Get product lots',
						description: 'Returns the lots associated with a product (sub-products, e.g. units in a building)',
					},
					{
						name: 'List Actions for a Product',
						value: 'listProductActionsGet',
						action: 'List actions for a product',
						description: 'Returns paginated action history for a product',
					},
					{
						name: 'Search Products',
						value: 'searchProductsPost',
						action: 'Search products',
						description: 'Searches products by criteria with cursor-based or offset-based pagination',
					},
					{
						name: 'Update a Product',
						value: 'updateProductPatch',
						action: 'Update a product',
						description: 'Partially updates a product. Only provided fields are modified.',
					},
				],
				default: 'addPrivatePhotoPost',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['transactions'] } },
				options: [
					{
						name: 'Get a Sale Transaction',
						value: 'getSaleTransactionGet',
						action: 'Get a sale transaction',
						description: 'Returns detailed information about a sale transaction (compromis, offer, or lease)',
					},
					{
						name: 'Search Leases',
						value: 'searchLeasesPost',
						action: 'Search leases',
						description: 'Searches lease agreements (baux de location) with cursor-based pagination',
					},
					{
						name: 'Search Sale Agreements',
						value: 'searchSaleAgreementsPost',
						action: 'Search sale agreements',
						description: 'Searches sale agreements (compromis de vente) with cursor-based pagination',
					},
					{
						name: 'Search Sales Offers',
						value: 'searchSalesOffersPost',
						action: 'Search sales offers',
						description: 'Searches sales offers (offres d\'achat) with cursor-based pagination',
					},
					{
						name: 'Update a Sale Transaction',
						value: 'updateSaleTransactionPut',
						action: 'Update a sale transaction',
						description: 'Updates billing and invoicing fields on a sale transaction',
					},
				],
				default: 'getSaleTransactionGet',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['users'] } },
				options: [
					{
						name: 'Create a User',
						value: 'createUserPost',
						action: 'Create a user',
						description: 'Creates a new user (agent/collaborator) in the system',
					},
					{
						name: 'Delete a User',
						value: 'deleteUserDelete',
						action: 'Delete a user',
						description: 'Deletes a user. Their properties, customers, and other entities are automatically reassigned according to the site\'s configuration rules.',
					},
					{
						name: 'Get a User',
						value: 'getUserGet',
						action: 'Get a user',
						description: 'Returns detailed information about a user (agent/collaborator)',
					},
					{
						name: 'List Genders',
						value: 'listGendersGet',
						action: 'List genders',
						description: 'Returns all available gender options',
					},
					{
						name: 'List User Groups',
						value: 'listUserGroupsGet',
						action: 'List user groups',
						description: 'Returns all available user groups (permission levels) for the site',
					},
					{
						name: 'List User Types',
						value: 'listUserTypesGet',
						action: 'List user types',
						description: 'Returns all available user types (professional roles) for the site',
					},
					{
						name: 'List Users',
						value: 'listUsersGet',
						action: 'List users',
						description: 'Returns all users (agents/collaborators) for the authenticated site, with optional filters and cursor-based pagination',
					},
					{
						name: 'Update a User',
						value: 'updateUserPatch',
						action: 'Update a user',
						description: 'Partially updates a user. Only provided fields are modified.',
					},
				],
				default: 'createUserPost',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['webhooks'] } },
				options: [
					{
						name: 'Create a Webhook',
						value: 'createWebhookPost',
						action: 'Create a webhook',
						description: 'Registers a new webhook subscription for specific events',
					},
					{
						name: 'Delete a Webhook',
						value: 'deleteWebhookDelete',
						action: 'Delete a webhook',
						description: 'Removes a webhook subscription. Events will no longer be delivered to this URL. This action is irreversible — to temporarily stop deliveries without losing the configuration, consider updating the URL to a placeholder instead.',
					},
					{
						name: 'List Webhooks',
						value: 'listWebhooksGet',
						action: 'List webhooks',
						description: 'Returns all webhooks registered by the authenticated client',
					},
					{
						name: 'Update a Webhook',
						value: 'updateWebhookPut',
						action: 'Update a webhook',
						description: 'Updates an existing webhook (URL, events, headers, auth)',
					},
				],
				default: 'createWebhookPost',
			},
			{
				displayName: 'Agency ID',
				name: 'agencyId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric identifier of the agency (manufacturer). Use the List Agencies operation to discover the IDs in scope.',
				displayOptions: {
					show: {
						operation: [
							'getAgencyGet',
						],
					},
				},
			},
			{
				displayName: 'Agreement ID',
				name: 'compromisId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric identifier of the sale transaction (compromis, offer or lease)',
				displayOptions: {
					show: {
						operation: [
							'getSaleTransactionGet',
							'updateSaleTransactionPut',
						],
					},
				},
			},
			{
				displayName: 'Criteria ID',
				name: 'criteriaId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric identifier of the product criteria',
				displayOptions: {
					show: {
						operation: [
							'getProductCriteriaByIdGet',
							'getProductCriteriaValuesGet',
						],
					},
				},
			},
			{
				displayName: 'Customer ID',
				name: 'customerId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric identifier of the customer contact',
				displayOptions: {
					show: {
						operation: [
							'createCustomerActionPost',
							'createFollowUpPost',
							'createSearchRequestPost',
							'deleteFollowUpDelete',
							'getCustomerGet',
							'listCustomerActionsGet',
							'listFollowUpsGet',
							'revokeColdCallingConsentDelete',
							'setColdCallingConsentPost',
							'updateCustomerPatch',
							'updateFollowUpPatch',
							'updateSearchRequestPatch',
						],
					},
				},
			},
			{
				displayName: 'Event ID',
				name: 'eventId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric identifier of the calendar event',
				displayOptions: {
					show: {
						operation: [
							'changeEventStatusPatch',
							'deleteEventDelete',
							'getEventGet',
							'updateEventPatch',
						],
					},
				},
			},
			{
				displayName: 'List ID',
				name: 'listeId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric identifier of the referential list, such as 1 for room types, 2 for expositions, 3 for views or 4 for floor types. One list per call.',
				displayOptions: {
					show: {
						operation: [
							'getListValuesGet',
						],
					},
				},
			},
			{
				displayName: 'Product ID',
				name: 'productId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric identifier of the product (property listing)',
				displayOptions: {
					show: {
						operation: [
							'addPrivatePhotoPost',
							'addPublicPhotoPost',
							'createFollowUpPost',
							'createProductActionPost',
							'deleteFollowUpDelete',
							'getProductGet',
							'getProductLotsGet',
							'listProductActionsGet',
							'updateFollowUpPatch',
							'updateProductPatch',
						],
					},
				},
			},
			{
				displayName: 'Search Request ID',
				name: 'searchRequestId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric identifier of the search request to update',
				displayOptions: {
					show: {
						operation: [
							'updateSearchRequestPatch',
						],
					},
				},
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric identifier of the user (agent/collaborator)',
				displayOptions: {
					show: {
						operation: [
							'deleteUserDelete',
							'getUserAvailabilityGet',
							'getUserGet',
							'getUserWorkingTimeGet',
							'listSharedAgendasGet',
							'updateUserPatch',
						],
					},
				},
			},
			{
				displayName: 'Webhook ID',
				name: 'hookId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric identifier of the webhook subscription',
				displayOptions: {
					show: {
						operation: [
							'deleteWebhookDelete',
							'updateWebhookPut',
						],
					},
				},
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the input binary field holding the photo to upload',
				displayOptions: {
					show: {
						operation: [
							'addPrivatePhotoPost',
							'addPublicPhotoPost',
						],
					},
				},
			},
			{
				displayName: 'Query Parameters',
				name: 'queryParameters',
				type: 'collection',
				placeholder: 'Add Query Parameter',
				default: {},
				description: 'Query string parameters of the selected operation. Only the ones the operation accepts are read by the API.',
				options: [
					{
						displayName: 'Agency ID',
						name: 'agency_id',
						type: 'number',
						default: 0,
						description: 'Agency whose configuration is requested. Must be within the authenticated site scope.',
					},
					{
						displayName: 'Agency IDs',
						name: 'agency_ids',
						type: 'string',
						default: '',
						description: 'Comma-separated agency IDs to filter on. Each ID must be within the authenticated site scope.',
					},
					{
						displayName: 'Archived',
						name: 'archived',
						type: 'boolean',
						default: false,
						description: 'Whether to include archived events in the result',
					},
					{
						displayName: 'Cursor',
						name: 'cursor',
						type: 'string',
						default: '',
						description: 'Pagination cursor. Pass the meta.next_cursor value of the previous response to fetch the next page. On the action endpoints this is a numeric offset instead.',
					},
					{
						displayName: 'Delegation',
						name: 'delegation',
						type: 'boolean',
						default: false,
						description: 'Whether to return only users who can delegate their work',
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'name@email.com',
						default: '',
						description: 'Filter users by email (partial match)',
					},
					{
						displayName: 'Exclude Types',
						name: 'exclude_types',
						type: 'string',
						default: '',
						description: 'Comma-separated event type keys to ignore when computing availability',
					},
					{
						displayName: 'Excluded Types',
						name: 'excluded_types',
						type: 'string',
						default: '',
						description: 'Comma-separated event type IDs to exclude from the result',
					},
					{
						displayName: 'Fetch',
						name: 'fetch',
						type: 'string',
						default: '',
						description: 'Comma-separated related data to hydrate on each result, such as criteres_text,descriptions,products_photos',
					},
					{
						displayName: 'First Name',
						name: 'firstname',
						type: 'string',
						default: '',
						description: 'Filter users by first name (partial match)',
					},
					{
						displayName: 'Format',
						name: 'format',
						type: 'options',
						options: [
							{ name: 'Tag Document', value: 'tag_document' },
						],
						default: 'tag_document',
						description: 'Response format. Use tag_document for the simplified format used in document generation.',
					},
					{
						displayName: 'From',
						name: 'from',
						type: 'string',
						default: '',
						description: 'Start of the period, as a local datetime without timezone suffix (YYYY-MM-DDTHH:MM:SS)',
					},
					{
						displayName: 'Include',
						name: 'include',
						type: 'string',
						default: '',
						description: 'Comma-separated relations to load in the response, such as buyer,seller,fees',
					},
					{
						displayName: 'Last Name',
						name: 'lastname',
						type: 'string',
						default: '',
						description: 'Filter users by last name (partial match)',
					},
					{
						displayName: 'Manufacturer ID',
						name: 'manufacturer_id',
						type: 'number',
						default: 0,
						description: 'Agency ID used to read the zone list of a different site context. Must be within the authenticated scope.',
					},
					{
						displayName: 'Offset',
						name: 'offset',
						type: 'number',
						default: 0,
						description: 'Number of events to skip from the start of the result set',
					},
					{
						displayName: 'Per Page',
						name: 'per_page',
						type: 'number',
						default: 50,
						description: 'Number of results per page. Maximum 200.',
					},
					{
						displayName: 'Per Page (Calendar)',
						name: 'perPage',
						type: 'number',
						default: 50,
						description: 'Number of calendar results per page. Values above 50 are capped to 50.',
					},
					{
						displayName: 'Recurring',
						name: 'recurring',
						type: 'boolean',
						default: true,
						description: 'Whether to expand recurring events into their individual occurrences within the search window',
					},
					{
						displayName: 'Slot Duration',
						name: 'slot_duration',
						type: 'number',
						default: 0,
						description: 'Duration of each returned availability slot, in minutes',
					},
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						options: [
							{ name: 'Active', value: 1 },
							{ name: 'Archived', value: 0 },
							{ name: 'Hidden or Deleted', value: 3 },
						],
						default: 1,
						description: 'Filter users by status',
					},
					{
						displayName: 'Telephone Code',
						name: 'telephone_code',
						type: 'boolean',
						default: false,
						description: 'Whether to format phone numbers in international form, such as +33601020304 instead of 0601020304',
					},
					{
						displayName: 'Timezone',
						name: 'tz',
						type: 'string',
						default: '',
						description: 'IANA timezone used to format the datetimes in the response, such as Europe/Paris. Defaults to UTC.',
					},
					{
						displayName: 'To',
						name: 'to',
						type: 'string',
						default: '',
						description: 'End of the period, as a local datetime without timezone suffix (YYYY-MM-DDTHH:MM:SS)',
					},
					{
						displayName: 'User ID (Query)',
						name: 'user_id',
						type: 'number',
						default: 0,
						description: 'User whose perspective is applied when reading events. Affects which confidential events are returned.',
					},
					{
						displayName: 'User IDs',
						name: 'user_ids',
						type: 'string',
						default: '',
						description: 'Comma-separated user (agent) IDs to filter on',
					},
					{
						displayName: 'Without Deleted',
						name: 'without_deleted',
						type: 'boolean',
						default: false,
						description: 'Whether to exclude deleted and archived users from the result',
					},
				],
			},
			{
				displayName: 'Request Body',
				name: 'requestBody',
				type: 'json',
				default: '{}',
				description: 'Raw JSON request body. See the Immofacile API reference of the selected operation for its schema.',
				displayOptions: {
					show: {
						operation: [
							'changeEventStatusPatch',
							'createBuyerLeadPost',
							'createCustomerActionPost',
							'createCustomerPost',
							'createEventPost',
							'createProductActionPost',
							'createProductPost',
							'createSearchRequestPost',
							'createSellerLeadPost',
							'createUserPost',
							'createWebhookPost',
							'searchCustomersPost',
							'searchLeasesPost',
							'searchProductsPost',
							'searchSaleAgreementsPost',
							'searchSalesOffersPost',
							'setColdCallingConsentPost',
							'updateCustomerPatch',
							'updateEventPatch',
							'updateFollowUpPatch',
							'updateProductPatch',
							'updateSaleTransactionPut',
							'updateSearchRequestPatch',
							'updateUserPatch',
							'updateWebhookPut',
						],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			// Errors from executeItem are already NodeApiError/NodeOperationError, so the
			// default path lets them propagate untouched rather than re-wrapping them.
			if (!this.continueOnFail()) {
				returnData.push(...(await executeItem.call(this, i)));
				continue;
			}

			try {
				returnData.push(...(await executeItem.call(this, i)));
			} catch (error) {
				returnData.push({
					json: { error: (error as Error).message },
					pairedItem: { item: i },
				});
			}
		}

		return [returnData];
	}
}

function requireParam(node: INode, itemIndex: number, label: string, value: string): void {
	if (value.trim() === '') {
		throw new NodeOperationError(node, `${label} is required`, { itemIndex });
	}
}

export async function executeItem(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const node = this.getNode();
	const resource = this.getNodeParameter('resource', i, '') as string;
	const operation = this.getNodeParameter('operation', i, '') as string;
	const authentication = this.getNodeParameter('authentication', 0, 'clientCredentials') as string;
	const credentialType =
		authentication === 'accessToken' ? 'immofacileApi' : 'immofacileClientCredentialsApi';

	const agencyId = this.getNodeParameter('agencyId', i, '') as string;
	const compromisId = this.getNodeParameter('compromisId', i, '') as string;
	const criteriaId = this.getNodeParameter('criteriaId', i, '') as string;
	const customerId = this.getNodeParameter('customerId', i, '') as string;
	const eventId = this.getNodeParameter('eventId', i, '') as string;
	const hookId = this.getNodeParameter('hookId', i, '') as string;
	const listeId = this.getNodeParameter('listeId', i, '') as string;
	const productId = this.getNodeParameter('productId', i, '') as string;
	const searchRequestId = this.getNodeParameter('searchRequestId', i, '') as string;
	const userId = this.getNodeParameter('userId', i, '') as string;

	const queryParameters = this.getNodeParameter('queryParameters', i, {}) as Record<
		string,
		string | number | boolean
	>;

	const queryParams = new URLSearchParams();
	Object.entries(queryParameters).forEach(([key, value]) => {
		if (value === '' || value === null || value === undefined) return;
		queryParams.append(key, String(value));
	});

	// Query parameters the API cannot answer without. They are supplied through the
	// Query Parameters collection like any other, so all this does is fail early with
	// a readable message instead of letting Immofacile answer 403 or 422.
	switch (operation) {
		case 'getPermanenceTimeframeGet':
			if (!queryParams.has('agency_id')) {
				throw new NodeOperationError(
					node,
					'This operation needs the Agency ID query parameter. Add it under Query Parameters',
					{ itemIndex: i },
				);
			}
			break;
		case 'listPermanenceUsersGet':
			if (!queryParams.has('agency_id')) {
				throw new NodeOperationError(
					node,
					'This operation needs the Agency ID query parameter. Add it under Query Parameters',
					{ itemIndex: i },
				);
			}
			break;
		default:
			break;
	}

	const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

	let endpointPath = '';

	switch (resource) {
		case 'agencies':
			switch (operation) {
				case 'getAgencyGet':
					requireParam(node, i, 'Agency ID', agencyId);
					endpointPath = `/agencies/${agencyId}${queryString}`;
					break;
				case 'listAgenciesGet':
					endpointPath = `/agencies${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		case 'agenda':
			switch (operation) {
				case 'changeEventStatusPatch':
					requireParam(node, i, 'Event ID', eventId);
					endpointPath = `/calendar/events/${eventId}/status${queryString}`;
					break;
				case 'createEventPost':
				case 'searchEventsGet':
					endpointPath = `/calendar/events${queryString}`;
					break;
				case 'deleteEventDelete':
				case 'getEventGet':
				case 'updateEventPatch':
					requireParam(node, i, 'Event ID', eventId);
					endpointPath = `/calendar/events/${eventId}${queryString}`;
					break;
				case 'getPermanenceTimeframeGet':
					endpointPath = `/calendar/permanences/timeframe${queryString}`;
					break;
				case 'getUserAvailabilityGet':
					requireParam(node, i, 'User ID', userId);
					endpointPath = `/calendar/users/${userId}/availability${queryString}`;
					break;
				case 'getUserWorkingTimeGet':
					requireParam(node, i, 'User ID', userId);
					endpointPath = `/calendar/users/${userId}/working-time${queryString}`;
					break;
				case 'listEventTypesGet':
					endpointPath = `/calendar/events/types${queryString}`;
					break;
				case 'listPermanenceUsersGet':
					endpointPath = `/calendar/permanences/timeframe/users${queryString}`;
					break;
				case 'listSharedAgendasGet':
					requireParam(node, i, 'User ID', userId);
					endpointPath = `/calendar/users/${userId}/shared-agenda${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		case 'configs':
			switch (operation) {
				case 'getListValuesGet':
					requireParam(node, i, 'List ID', listeId);
					endpointPath = `/configs/listes/${listeId}/values${queryString}`;
					break;
				case 'listActionTypesGet':
					endpointPath = `/actions/types${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		case 'criterias':
			switch (operation) {
				case 'getProductCriteriaByIdGet':
					requireParam(node, i, 'Criteria ID', criteriaId);
					endpointPath = `/criterias/product/${criteriaId}${queryString}`;
					break;
				case 'getAllProductCriteriaGet':
					endpointPath = `/criterias/product/all${queryString}`;
					break;
				case 'getProductCriteriaValuesGet':
					requireParam(node, i, 'Criteria ID', criteriaId);
					endpointPath = `/criterias/product/${criteriaId}/values${queryString}`;
					break;
				case 'getSearchRequestCriteriaGet':
					endpointPath = `/criterias/search-requests${queryString}`;
					break;
				case 'getZoneListGet':
					endpointPath = `/criterias/zone-list${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		case 'customers':
			switch (operation) {
				case 'createCustomerPost':
					endpointPath = `/customers${queryString}`;
					break;
				case 'createFollowUpPost':
				case 'deleteFollowUpDelete':
				case 'updateFollowUpPatch':
					requireParam(node, i, 'Customer ID', customerId);
					requireParam(node, i, 'Product ID', productId);
					endpointPath = `/customers/${customerId}/follow-ups/${productId}${queryString}`;
					break;
				case 'createSearchRequestPost':
					requireParam(node, i, 'Customer ID', customerId);
					endpointPath = `/customers/${customerId}/search-requests${queryString}`;
					break;
				case 'createCustomerActionPost':
				case 'listCustomerActionsGet':
					requireParam(node, i, 'Customer ID', customerId);
					endpointPath = `/customers/${customerId}/actions${queryString}`;
					break;
				case 'setColdCallingConsentPost':
				case 'revokeColdCallingConsentDelete':
					requireParam(node, i, 'Customer ID', customerId);
					endpointPath = `/customers/${customerId}/consent${queryString}`;
					break;
				case 'getCustomerGet':
				case 'updateCustomerPatch':
					requireParam(node, i, 'Customer ID', customerId);
					endpointPath = `/customers/${customerId}${queryString}`;
					break;
				case 'listCustomerGroupsGet':
					endpointPath = `/customers/groups${queryString}`;
					break;
				case 'listCustomerOriginsGet':
					endpointPath = `/customers/origins${queryString}`;
					break;
				case 'listFollowUpsGet':
					requireParam(node, i, 'Customer ID', customerId);
					endpointPath = `/customers/${customerId}/follow-ups${queryString}`;
					break;
				case 'searchCustomersPost':
					endpointPath = `/customers/search${queryString}`;
					break;
				case 'updateSearchRequestPatch':
					requireParam(node, i, 'Customer ID', customerId);
					requireParam(node, i, 'Search Request ID', searchRequestId);
					endpointPath = `/customers/${customerId}/search-requests/${searchRequestId}${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		case 'discovery':
			switch (operation) {
				case 'getAccessibleScopeGet':
					endpointPath = `/discovery${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		case 'leads':
			switch (operation) {
				case 'createBuyerLeadPost':
					endpointPath = `/leads/buyers${queryString}`;
					break;
				case 'createSellerLeadPost':
					endpointPath = `/leads/sellers${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		case 'products':
			switch (operation) {
				case 'addPrivatePhotoPost':
					requireParam(node, i, 'Product ID', productId);
					endpointPath = `/products/${productId}/pictures/private${queryString}`;
					break;
				case 'addPublicPhotoPost':
					requireParam(node, i, 'Product ID', productId);
					endpointPath = `/products/${productId}/pictures/public${queryString}`;
					break;
				case 'createProductPost':
					endpointPath = `/products${queryString}`;
					break;
				case 'createProductActionPost':
				case 'listProductActionsGet':
					requireParam(node, i, 'Product ID', productId);
					endpointPath = `/products/${productId}/actions${queryString}`;
					break;
				case 'getProductGet':
				case 'updateProductPatch':
					requireParam(node, i, 'Product ID', productId);
					endpointPath = `/products/${productId}${queryString}`;
					break;
				case 'getProductLotsGet':
					requireParam(node, i, 'Product ID', productId);
					endpointPath = `/products/${productId}/lots${queryString}`;
					break;
				case 'searchProductsPost':
					endpointPath = `/products/search${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		case 'transactions':
			switch (operation) {
				case 'getSaleTransactionGet':
				case 'updateSaleTransactionPut':
					requireParam(node, i, 'Agreement ID', compromisId);
					endpointPath = `/agreement/${compromisId}${queryString}`;
					break;
				case 'searchLeasesPost':
					endpointPath = `/transactions/leases/search${queryString}`;
					break;
				case 'searchSaleAgreementsPost':
					endpointPath = `/transactions/agreement/search${queryString}`;
					break;
				case 'searchSalesOffersPost':
					endpointPath = `/transactions/sales-offers/search${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		case 'users':
			switch (operation) {
				case 'createUserPost':
				case 'listUsersGet':
					endpointPath = `/users${queryString}`;
					break;
				case 'deleteUserDelete':
				case 'getUserGet':
				case 'updateUserPatch':
					requireParam(node, i, 'User ID', userId);
					endpointPath = `/users/${userId}${queryString}`;
					break;
				case 'listGendersGet':
					endpointPath = `/users/genders${queryString}`;
					break;
				case 'listUserGroupsGet':
					endpointPath = `/users/groups${queryString}`;
					break;
				case 'listUserTypesGet':
					endpointPath = `/users/types${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		case 'webhooks':
			switch (operation) {
				case 'createWebhookPost':
				case 'listWebhooksGet':
					endpointPath = `/hooks${queryString}`;
					break;
				case 'deleteWebhookDelete':
				case 'updateWebhookPut':
					requireParam(node, i, 'Webhook ID', hookId);
					endpointPath = `/hooks/${hookId}${queryString}`;
					break;
				default:
					throw new NodeOperationError(node, `Unknown operation: ${operation}`);
			}
			break;
		default:
			throw new NodeOperationError(node, `Unknown resource: ${resource}`);
	}

	const method: IHttpRequestMethods = operation.endsWith('Delete')
		? 'DELETE'
		: operation.endsWith('Patch')
			? 'PATCH'
			: operation.endsWith('Put')
				? 'PUT'
				: operation.endsWith('Post')
					? 'POST'
					: 'GET';

	// The host is part of the credential, not of the node, so that the same workflow
	// can be pointed at staging or production by swapping credentials.
	const credentials = await this.getCredentials(credentialType);
	const host = HOSTS[(credentials.environment as string) ?? 'production'] ?? HOSTS.production;
	const url = `${host}${API_PREFIX}${endpointPath}`;

	if (UPLOAD_OPERATIONS[operation]) {
		const uploaded = await uploadRequest.call(this, i, credentialType, method, url, operation);
		return this.helpers.constructExecutionMetaData(
			this.helpers.returnJsonArray(normalizeResponse(uploaded)),
			{ itemData: { item: i } },
		);
	}

	const headers: IDataObject = { Accept: 'application/json' };
	let body: IDataObject | undefined;

	if (['PATCH', 'POST', 'PUT'].includes(method)) {
		const raw = ((this.getNodeParameter('requestBody', i, '') as string) ?? '').trim();
		if (raw !== '' && raw !== '{}') {
			try {
				body = JSON.parse(raw) as IDataObject;
			} catch {
				throw new NodeOperationError(node, 'Request Body is not valid JSON', {
					itemIndex: i,
				});
			}
			headers['Content-Type'] = 'application/json';
		}
	}

	const options: IHttpRequestOptions = {
		method,
		url,
		headers,
		json: true,
		...(body !== undefined ? { body } : {}),
	};

	let response: unknown;
	try {
		response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			credentialType,
			options,
		);
	} catch (error) {
		// n8n only reads a description out of a JSON body, and drops the X-Request-Id
		// header their support asks for: describeApiError spells both out.
		throw new NodeApiError(node, error as JsonObject, {
			message: `Immofacile API request failed: ${method} ${endpointPath}`,
			description: describeApiError(error),
			itemIndex: i,
		});
	}

	return this.helpers.constructExecutionMetaData(
		this.helpers.returnJsonArray(normalizeResponse(response)),
		{ itemData: { item: i } },
	);
}


/**
 * Status, Immofacile error code, message, field details and request id, from either
 * an axios error (httpRequest) or a request-library error (requestWithAuthentication).
 * Falls back to the start of a non-JSON body, such as a reverse proxy error page.
 */
function describeApiError(error: unknown): string | undefined {
	// httpRequestWithAuthentication already wraps the axios error in its own
	// NodeApiError: the response sits on error.cause, one or more levels down.
	let err = (error ?? {}) as IDataObject;
	const outer = err;
	for (let depth = 0; depth < 5 && !err.response && err.cause; depth++) {
		err = err.cause as IDataObject;
	}
	const response = (err.response ?? {}) as IDataObject;
	const status = (response.status ?? err.statusCode ?? response.statusCode ?? outer.httpCode) as
		| number
		| string
		| undefined;
	const headers = (response.headers ?? {}) as IDataObject;
	const requestId = headers['x-request-id'] as string | undefined;
	let data = response.data ?? response.body ?? err.error ?? (outer.context as IDataObject | undefined)?.data;
	if (typeof data === 'string') {
		try {
			data = JSON.parse(data);
		} catch {
			// not JSON: kept as text below
		}
	}

	const parts: string[] = [];
	if (status) parts.push(`HTTP ${status}`);
	if (data && typeof data === 'object' && !Array.isArray(data)) {
		const body = data as IDataObject;
		const apiError = (typeof body.error === 'object' && body.error !== null ? body.error : body) as IDataObject;
		if (apiError.code) parts.push(String(apiError.code));
		if (apiError.message) parts.push(String(apiError.message));
		if (Array.isArray(apiError.details)) {
			for (const detail of apiError.details as IDataObject[]) {
				parts.push(`${detail.field ?? '?'}: ${detail.message ?? JSON.stringify(detail)}`);
			}
		}
		// Criteria errors come back as {"criteria.65": [{xml, message}]}, with no
		// code or message at the top: list those field by field instead.
		if (!apiError.code && !apiError.message) {
			for (const [field, value] of Object.entries(body)) {
				const entries = Array.isArray(value) ? (value as IDataObject[]) : [value as IDataObject];
				for (const entry of entries) {
					if (entry && typeof entry === 'object') {
						parts.push(`${entry.xml ?? field}: ${entry.message ?? JSON.stringify(entry)}`);
					} else {
						parts.push(`${field}: ${String(entry)}`);
					}
				}
			}
		}
		const bodyRequestId = (apiError.request_id ?? body.request_id) as string | undefined;
		if (!requestId && bodyRequestId) parts.push(`request_id ${bodyRequestId}`);
	} else if (typeof data === 'string' && data.trim() !== '') {
		parts.push(data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300));
	}
	if (requestId) parts.push(`X-Request-Id ${requestId}`);
	return parts.length > 0 ? parts.join(' | ') : undefined;
}
function normalizeResponse(response: unknown): IDataObject | IDataObject[] {
	if (response === null || response === undefined || response === '') {
		return { success: true, statusCode: 204 };
	}

	if (typeof response === 'string') {
		const trimmed = response.trim();
		if (trimmed === '') {
			return { success: true, statusCode: 204 };
		}
		try {
			return JSON.parse(trimmed) as IDataObject;
		} catch {
			return { message: trimmed };
		}
	}

	return response as IDataObject | IDataObject[];
}

async function uploadRequest(
	this: IExecuteFunctions,
	i: number,
	credentialType: string,
	method: IHttpRequestMethods,
	url: string,
	operation: string,
): Promise<unknown> {
	const node = this.getNode();
	const fieldName = UPLOAD_OPERATIONS[operation];
	const binaryPropertyName = (this.getNodeParameter('binaryPropertyName', i, 'data') as string).trim();
	const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);

	if (!binaryData.fileName) {
		throw new NodeOperationError(
			node,
			`No file name set on binary property "${binaryPropertyName}"`,
			{ itemIndex: i },
		);
	}

	let value: Buffer | NodeJS.ReadableStream;
	if (binaryData.id) {
		// Streamed from the binary data store: the size is unknown here, so an oversized
		// file surfaces as an Immofacile 413/422 through NodeApiError instead.
		value = await this.helpers.getBinaryStream(binaryData.id);
	} else {
		const buffer = Buffer.from(binaryData.data, BINARY_ENCODING);
		if (buffer.byteLength > MAX_UPLOAD_BYTES) {
			throw new NodeOperationError(
				node,
				`File "${binaryData.fileName}" is ${Math.round(buffer.byteLength / 1024 / 1024)} MB. Immofacile rejects photos larger than 20 MB`,
				{ itemIndex: i },
			);
		}
		value = buffer;
	}

	const formData: IDataObject = {
		[fieldName]: {
			value,
			options: { filename: binaryData.fileName, contentType: binaryData.mimeType },
		},
	};

	try {
		// httpRequestWithAuthentication is axios-based and IHttpRequestOptions has no
		// `formData` field, so multipart uploads go through the request-compatible helper,
		// which builds the boundary itself. Do not "unify" these two call sites.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return await (this.helpers as any).requestWithAuthentication.call(this, credentialType, {
			method,
			url,
			headers: { Accept: 'application/json' },
			formData,
			json: true,
		});
	} catch (error) {
		throw new NodeApiError(node, error as JsonObject, {
			message: `Immofacile file upload failed: ${method} ${url}`,
			description: describeApiError(error),
			itemIndex: i,
		});
	}
}
