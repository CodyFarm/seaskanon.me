# Codex Research Knowledge Base Design

## Purpose

Build a local, single-user research knowledge base for Codex. It must support philosophical-text research across arbitrary user-selected source directories, preserve precise citations, and allow extended reading of original passages.

Cherry Studio is out of scope. This system neither reads nor depends on Cherry Studio's source files, index files, or internal APIs.

## Confirmed Constraints

- The only consumer is the local Codex desktop app.
- Source material is selected through explicit directory allowlists. The system must never scan the whole computer.
- Each selected knowledge base can include one or more source directories.
- Supported input formats in the first release are Markdown, plain text, PDF with selectable text, DOCX, and EPUB.
- Scanned/image-only PDFs do not receive OCR in the first release. They are skipped and reported.
- Index changes occur only through an explicit, manual sync command.
- The embedding provider is OpenRouter, using a Qwen embedding model through an OpenAI-compatible HTTP embeddings API.
- Source text sent for indexing and search queries are sent to OpenRouter. The user accepts this for allowlisted sources.
- The system supports multiple named knowledge bases and both per-library and cross-library retrieval.
- Retrieval uses hybrid search: semantic vector search plus local keyword full-text search.
- The local installation and index directory is `C:\Users\importme\codex-knowledge-base\`.

## Architecture

```text
Allowlisted source directories
            |
            v
Manual sync CLI
(parse, chunk, hash, embed)
            |--------------------> OpenRouter Qwen Embeddings API
            v
SQLite FTS5 + metadata          LanceDB vectors
            \                    /
             \                  /
              v                v
              Local STDIO MCP server
                       |
                       v
                     Codex
```

The installation is a self-contained local Python application. It does not need Docker, a browser service, a listening network port, user accounts, or a cloud vector database.

SQLite holds source configuration, document and chunk metadata, content hashes, sync state, and an FTS5 index. LanceDB holds the embedding vectors and their chunk identifiers. The two stores are implementation details behind the MCP interface.

## Knowledge Base Model

Each named knowledge base has:

- a stable identifier and display name;
- an explicit list of absolute source directory paths;
- supported file-type settings;
- one embedding provider configuration reference, model name, and verified vector dimension;
- local SQLite and LanceDB index locations;
- sync status and a persistent failure report.

Changing the model or its embedding dimension invalidates existing vectors. The application must refuse to mix vectors from different model configurations and require a deliberate rebuild of the affected library.

## Source Processing and Sync

The management CLI provides commands to create and inspect libraries, add or remove source directories, sync a library, show sync failures, and rebuild a library.

During a manual sync, the application recursively visits only configured source directories. It extracts text and source locations from supported files, then splits text preferentially at document titles, headings, paragraphs, and page boundaries. Long text is split into chunks of about 700 tokens with approximately 100 tokens of overlap.

Each document and chunk has a content hash. Unchanged content is not sent to OpenRouter again. New and changed chunks are embedded in batches; removed source files cause their chunks to be removed from both local indexes.

Sync is transactional at the generation level: extraction, chunking, and embedding are completed in a new temporary generation before it becomes active. A failed API call, rate limit, or parser failure does not replace the existing usable generation. Individual unsupported or unreadable files are skipped and recorded with a reason.

## Retrieval and Research Reading

The MCP server exposes read-only tools only. It does not expose arbitrary file access, SQL, sync, configuration changes, or deletion.

### `list_knowledge_bases`

Returns named libraries, their source count, active index status, model identity, and latest sync summary. It does not return API credentials.

### `search_knowledge_base`

Inputs: query, optional library selection, optional source filter, and a configurable result limit.

The server generates one query embedding with OpenRouter and runs it against the relevant LanceDB indexes. It also runs local FTS5 keyword search. Reciprocal-rank fusion combines the candidate lists. The default research-oriented result count is 10 to 15 concise hits. Every result includes a stable chunk reference, knowledge-base name, document title, original source path, file format, chapter or heading where available, PDF page where available, and a short excerpt.

### `get_context`

Accepts only a chunk reference produced by a retrieval result and returns a continuous window around that chunk. The default limit is approximately 8,000 Chinese characters, configurable within a bounded maximum. This supports contextual interpretation without exposing unrestricted local file reads.

### `read_section`

Accepts a document reference and an optional chapter/section reference or cursor. It returns continuous original text with source locations. The default response limit is about 12,000 Chinese characters and may be increased to 24,000 characters. Longer material is retrieved with a cursor, so one tool call does not crowd out the research question or source citations in Codex's context.

Reading stored source text does not call OpenRouter and incurs no embedding API charge.

## Credentials and Privacy

The OpenRouter API key is read from a local environment variable and is never stored in the application configuration, SQLite, LanceDB, MCP output, logs, or source-control files. Configuration stores only a credential environment-variable name, API base URL, model identifier, batch settings, and rate limits.

Only source directories explicitly added to a library are eligible for extraction and transmission to OpenRouter. The implementation must make this external transmission visible in setup and sync output.

## Reliability

- Validate the OpenRouter connection, selected model, and vector dimension before the first usable index is created.
- Batch embedding requests, impose configurable concurrency and rate limits, and retry transient failures with exponential backoff.
- Preserve the current active generation until a replacement generation finishes successfully.
- Clearly report skipped scanned PDFs, encrypted or corrupt documents, unsupported formats, parser errors, and exhausted API retries.
- Store indexes in the chosen local directory so that backing up that directory preserves the libraries and indexes.
- Deletion and rebuild operations require explicit local CLI commands; they are unavailable through MCP.

## Configuration Layout

```text
C:\Users\importme\codex-knowledge-base\
  config\
    libraries.toml
  data\
    <library-id>\
      metadata.sqlite
      vectors.lance\
      generations\
  reports\
    <library-id>-latest-sync.json
  logs\
```

Codex's MCP configuration references the installed server command through a local STDIO entry in the user's Codex configuration. The command receives the application data directory and reads the API key from the environment at runtime.

## Acceptance Criteria

1. A user can create at least two named libraries with different explicit source directories.
2. A sync indexes supported Markdown, TXT, text-based PDF, DOCX, and EPUB inputs and reports image-only PDFs as skipped.
3. Re-running sync without changes makes no embedding requests; modifying or deleting a source updates only the affected document/chunks.
4. A known philosophical concept retrieves semantically relevant passages, while a precise author name, title, term, or phrase retrieves exact matches through hybrid search.
5. Search results contain enough document, section, and page metadata to locate the original passage.
6. `get_context` and paginated `read_section` return contiguous original text around relevant material without further OpenRouter requests.
7. Cross-library search returns the originating library for every hit.
8. A transient embedding failure leaves the prior active index searchable and appears in the sync report.
9. The MCP server offers only the three read-only retrieval tools and cannot read arbitrary paths or mutate indexes.

## Out of Scope for the First Release

- OCR for scanned PDFs.
- Cherry Studio interoperability.
- Network, multi-device, multi-user, or web deployment.
- Automatic filesystem watching.
- Arbitrary database querying or arbitrary local-file access through MCP.
