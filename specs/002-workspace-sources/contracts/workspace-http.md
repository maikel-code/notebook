# Workspace Interface Contract

## `POST /api/web/search`

**Caller**: authenticated notebook owner.

**Request**:

```json
{ "notebookId": "uuid", "query": "string" }
```

`query` is trimmed, non-empty and at most 200 characters. The server authorizes the notebook before calling the search adapter.

**Success**:

```json
{
  "results": [
    {
      "title": "string",
      "domain": "example.org",
      "description": "string",
      "url": "https://example.org/article"
    }
  ]
}
```

At most ten results. The response has no stored source identifier.

**Failure**: unauthenticated requests receive the existing sign-in behavior; foreign notebook identifiers receive the existing not-found behavior; invalid query yields a field error; unavailable search yields a recoverable error without leaking provider detail.

## `importWebSources` server action

**Caller**: authenticated notebook owner.

**Input**: notebook identifier plus one to ten selected HTTPS result addresses. The server validates every address, rejects duplicate canonical addresses in the notebook, creates sources in `processing`, starts their owned jobs, then refreshes the notebook.

**Result**: per-address status (`started`, `already_present`, `rejected`, `failed`). Only `started` creates a source. The action never accepts a browser-supplied text body as source content.

## `saveAnswerAsNote` server action

**Caller**: authenticated notebook owner.

**Input**: notebook identifier and assistant message identifier.

**Success**: returns the existing or new note identifier. It only accepts a complete, verified answer belonging to the notebook; it inserts title and content snapshot atomically with a unique message relationship.

**Failure**: foreign, anonymous, running, failed, aborted or invalid messages use the existing no-existence-disclosure/error behavior. No partial note is created.

## Read contracts

The Notebook page supplies owner-scoped source detail data, orientation data and note previews. The source detail client component never downloads a web source through Storage. Web source citations render a labeled external link; PDF citations retain the existing source viewer. Removed sources retain citation quote and “Quelle entfernt” without a document or web link.
