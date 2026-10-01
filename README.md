# n8n-nodes-immofacile  

This is an n8n community node. It lets you interact with Immofacile in your n8n workflows.  

Immofacile (Orisha Real Estate) is a SaaS CRM for real estate agencies: agents keep their property listings, owners, buyers and tenants there, track visits and sale agreements, run their agenda, and publish their catalogue to portals and agency websites.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.  

[Installation](#installation)  
[Credentials](#credentials)    
[Operations](#operations)   
[Discovery first](#discovery-first)  
[Criteria and referentials](#criteria-and-referentials)  
[Pagination](#pagination)  
[File uploads](#file-uploads)  
[No trigger node](#no-trigger-node)  
[Using as a Tool](#using-as-a-tool)  
[Compatibility](#compatibility)  
[Resources](#resources)  

## Installation  

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.  

Alternatively, you can manually install it:  

```sh  
git clone https://github.com/elevate-agency-data/n8n-nodes-immofacile.git 
cd n8n-nodes-immofacile 
npm install  
```  

Then, place the node file in the `~/.n8n/custom-nodes` directory (or follow instructions specific to your n8n installation).   

## Credentials  

This node covers version 2 of the Immofacile Site API and supports two ways to authenticate. Both credentials carry an **Environment** field that selects the host: *Production* (`https://v2.immo-facile.com`) or *Staging* (`https://ac3.staging.immo-facile.com`).

**Leave Environment on *Production*.** The staging host is listed in the API reference but its reverse proxy answers `403 Forbidden` to every request, token endpoint included — the documentation itself describes the sandbox as "coming soon".

**Immofacile Client Credentials API** — the recommended option, and the default. Enter the `Client ID` and `Client Secret` generated from the Immofacile admin dashboard, then say how the token is scoped: by **Site ID**, or by **Agency ID (Manufacturer)** when you only know the agency. The credential exchanges these for a Bearer token against `POST /api/client/token/site` and refreshes it on its own when it expires, so nothing in the workflow has to deal with the token.

**Immofacile API (access token)** — paste a Bearer token you already obtained from `POST /api/client/token/site`. Immofacile tokens expire, so this is mainly useful for a quick test or when the token comes from somewhere else in your infrastructure.

Authentication is tied to a **Site**, which groups one or more agencies (*manufacturers*). The token reaches every agency in the site's `manufacturers_list`, and the `agency_id` you pass in a request body must be one of them. If your agencies are spread over several sites, create one credential per site.

Tokens are valid for 7 days (`expires_in: 604800`). The Client Credentials credential renews them by itself, so this only matters if you paste a token into the Access Token credential by hand.

## Operations  

This node supports the following operations within Immofacile:  
* **Agencies**
    - Get Agency Details
    - List Agencies
* **Agenda**
    - Change Event Status
    - Create an Event
    - Delete an Event
    - Get an Event
    - Get Permanence Timeframe
    - Get User Availability
    - Get User Working Time
    - List Event Types
    - List Permanence Users
    - List Shared Agendas
    - Search Events
    - Update an Event
* **Configs**
    - Get List Values
    - List Action Types
* **Criterias**
    - Get a Product Criteria by ID
    - Get All Product Criteria
    - Get Product Criteria Values
    - Get Search Request Criteria
    - Get Zone List
* **Customers**
    - Create a Customer
    - Create a Follow-Up
    - Create a Search Request
    - Create an Action for a Customer
    - Create or Update Cold-Calling Consent
    - Delete a Follow-Up
    - Get a Customer
    - List Actions for a Customer
    - List Customer Groups
    - List Customer Origins
    - List Follow-Ups
    - Revoke Cold-Calling Consent
    - Search Customers
    - Update a Customer
    - Update a Follow-Up
    - Update a Search Request
* **Discovery**
    - Get Accessible Scope
* **Leads**
    - Create a Buyer Lead
    - Create a Seller Lead
* **Products**
    - Add a Private Photo
    - Add a Public Photo
    - Create a Product
    - Create an Action for a Product
    - Get a Product
    - Get Product Lots
    - List Actions for a Product
    - Search Products
    - Update a Product
* **Transactions**
    - Get a Sale Transaction
    - Search Leases
    - Search Sale Agreements
    - Search Sales Offers
    - Update a Sale Transaction
* **Users**
    - Create a User
    - Delete a User
    - Get a User
    - List Genders
    - List User Groups
    - List User Types
    - List Users
    - Update a User
* **Webhooks**
    - Create a Webhook
    - Delete a Webhook
    - List Webhooks
    - Update a Webhook

Retrieve information from the [Immofacile API V2](https://api-immofacile.redocly.app/openapi).

Each operation also needs the matching permission and right on the client (for instance `SITE_PRODUCT:READ` plus `RS:PRODUCT_SEARCH` for *Search Products*), which are granted per client in the Immofacile back-office. `Agenda` additionally requires the `MODULE_IMMO_AGENDA` module. The requirement of every operation is listed on its page in the API reference.

## Discovery first

Start every integration with `Discovery → Get Accessible Scope` (`GET /discovery`). It returns the agencies and sites your client can reach, and the `agency_id` values it lists are the ones every other operation expects. `Agencies → List Agencies` gives the same scope with pagination.

## Criteria and referentials

Property listings do not have fixed columns: almost everything is a **criterion**, sent as `{"id": ..., "value": ...}`. The `id` accepts either the XML key (`TypeBien`, `Prix`, `Surface`) or the numeric ID (`27`), but the `value` of a `UNIQUE` or `MULTIPLE` criterion must be the **value code** — the `model` field of the referential — not its numeric ID: `"Appartement"`, never `"1"`.

Use the `Criterias` resource to discover what your site accepts before writing:

- `Get All Product Criteria` — every product criterion, with its type (`UNIQUE`, `NUMBER`, `FLAG`, `TEXT`, `MULTIPLE`, `DATE`)
- `Get a Product Criteria by ID` — one criterion with its definition
- `Get Product Criteria Values` — the valid values of a UNIQUE or MULTIPLE criterion, whose `model` field is what you send
- `Get Search Request Criteria` — the criteria available for buyer search requests
- `Get Zone List` — the geographic zones used in search criteria
- `Configs → Get List Values` — other referentials, such as room types (list 1), expositions (2), views (3) and floor types (4). One list per call: the comma-separated form the API reference documents is rejected
- `Configs → List Action Types` — the `action_id` that both `Create an Action` operations require

Two traps worth remembering: a new listing is only visible in the interface when its `Statut` criterion is `EnCours`, and the search endpoint spells the field `criterias` while create and update spell it `criteria`.

## Pagination

This node does not paginate for you: it sends exactly one request per input item, so you stay in control of how many calls you make. Immofacile uses two conventions, and both are driven from the **Query Parameters** collection:

- **Cursor** (agencies, products, customers, transactions, users, event types): set `Per Page`, then feed `meta.next_cursor` from the response back into the `Cursor` parameter on the next call. Stop when the response reports no next cursor. On the search endpoints the cursor lives in the JSON body instead, alongside the filters.
- **Offset** (`List Actions for a Product`, `List Actions for a Customer`, `Search Events`): `Cursor` is a number of items to skip on the action endpoints, and `Search Events` uses `Offset` with `Per Page (Calendar)`.

To collect every page, wrap the node in a loop: a **Loop Over Items** node, or an **If** node testing whether the response still carries a next cursor, feeding the value back into the Immofacile node.

## File uploads

Two operations upload a file instead of sending JSON, and expect binary data on the input item:

- `Products → Add a Public Photo`
- `Products → Add a Private Photo`

Set **Input Binary Field** to the name of the binary property holding the image. **Photos must be at least 800px wide, and Immofacile rejects files larger than 20 MB.**

`Customers → Create or Update Cold-Calling Consent` also accepts proof files over `multipart/form-data`. This node sends that operation as JSON, so the consent itself can be recorded but proof files cannot be attached.

## No trigger node

There is deliberately no Immofacile Trigger node, but Immofacile does push events — and their documentation states plainly that *intensive polling is prohibited on the platform*, so webhooks are the supported way to stay in sync.

Register a subscription with `Webhooks → Create a Webhook`, pointing `url` at an n8n **Webhook** node and listing the events in `origines` (`CUSTOMER_CREATE`, `CUSTOMER_UPDATE`, `PRODUCT_CREATE`, `PRODUCT_UPDATE`, and so on). Each payload carries the `event_type` and the `resource_id`, which you then read back with `Get a Product` or `Get a Customer`.

Answer 200 within 10 seconds. A 422 marks the resource as errored on Immofacile's side with the reason from your body — useful to reject data deliberately. Any other error is retried 3 times with growing delay, after which the webhook is **suspended** and stops delivering until you reactivate it with `Update a Webhook`.

## Using as a Tool

This node can be used as a tool in n8n AI Agents. To enable community nodes as tools, you need to set the `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE` environment variable to `true`.

### Setting the Environment Variable

**If you're using a bash/zsh shell:**
```bash
export N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
n8n start
```

**If you're using Docker:**
Add to your docker-compose.yml file:
```yaml
environment:
  - N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

**If you're using the desktop app:**
Create a `.env` file in the n8n directory:
```
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

**If you want to set it permanently on Mac/Linux:**
Add to your `~/.zshrc` or `~/.bash_profile`:
```bash
export N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

## Compatibility  

- Tested with: TBD

Of the 66 operations, 64 are built from the Immofacile API V2 OpenAPI specification. The other two — **Criterias → Get Product Criteria Values** and **Configs → List Action Types** — are absent from that specification but served by the API, and referenced in prose by the operations that need their values; both were confirmed against the live API.

The read operations have been exercised against a live site. The 28 write operations have deliberately not been fired.

Two things sit on your own tenant rather than on the node. Every operation needs its permission and right granted to the client in the back-office, so a 403 almost always means a missing right rather than a bad request. And the `Agenda` resources are only reachable when the `MODULE_IMMO_AGENDA` module is enabled for the agency.

Every error response carries a `request_id`, echoed in the `X-Request-Id` response header. Immofacile's dev support (api.imf@orisha.com) asks for it, along with the payload you sent and the environment, on any integration issue.

## Resources  

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)  
- [Immofacile API V2 documentation](https://api-immofacile.redocly.app/openapi)
- [Authentication](https://api-immofacile.redocly.app/openapi/authentication/obtainsitetoken)
- [Webhooks](https://api-immofacile.redocly.app/openapi/webhooks/createwebhook)
