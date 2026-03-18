# Welcome to DiagramaHub

Welcome to the official documentation for the **DiagramaHub** codebase!

This documentation is built with [MkDocs](https://squidfunk.github.io/mkdocs-material/) and is designed to be the single source of truth for all developers working on the project.

## What will you find here?

In these manuals you can discover:

* **Architecture:** How the frontend and backend communicate.
* **Local Development Guide:** How to set up external databases and run the project for the first time.
* **Workflows:** How to deploy changes and contribute to the repository.

## Main Repository Structure

Our codebase follows a domain-separated _monorepo_ scheme:

```text
diagramahub/
├── frontend/           # React web app
├── backend/            # REST API and integrations   
├── docs/               # This very documentation
└── deploy/             # Infrastructure configuration and files
```

---

*To test this page, run the following command in your terminal:*
```bash
mkdocs serve
```
