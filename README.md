# arc-fe-e2e

## About The Project

This project contains a suite of end-to-end tests for the ARPU project. The aim is to have a wide cover of the flows and test the UX in several browser environment.

### Built With

- [Playwright](https://playwright.dev/)

## Getting Started

### Prerequisites

In order to build and run this project are required:

- [yarn](https://yarnpkg.com/)
- [node (>=16.0.0)](https://nodejs.org/it/)

### Configuration

The table below describes all the Environment variables needed by the application.

| Variable name                    | Description                | type                  |
| -------------------------------- | -------------------------- | --------------------- |
| BASE_URL                         | the target site            | url                   |
| USER_NAME                        | the user name              | string                |
| USER_PASSWORD                    | the user password          | string                |

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/pagopa/arpu-fe-e2e.git
   ```
2. Install node packages
   ```sh
   yarn install
   ```
3. Create a file `.env` in the root and copy & paste the content of `.env.example` one. Modify the values appropriately (see the reference above).

### Usage

Start the test

```sh
yarn test
```

Or, if desired, test a single file

```sh
yarn test tests/FILENAME.spec.ts
```
