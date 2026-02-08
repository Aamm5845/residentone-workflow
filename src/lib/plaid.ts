/**
 * Plaid SDK Client Singleton
 * Uses environment variables for configuration
 */

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

let plaidClient: PlaidApi | null = null

export function getPlaidClient(): PlaidApi {
  if (plaidClient) return plaidClient

  const env = process.env.PLAID_ENV || 'sandbox'
  const clientId = process.env.PLAID_CLIENT_ID
  const secret =
    env === 'production'
      ? process.env.PLAID_SECRET_PRODUCTION
      : process.env.PLAID_SECRET_SANDBOX

  if (!clientId || !secret) {
    throw new Error('Missing Plaid credentials. Set PLAID_CLIENT_ID and PLAID_SECRET_* in .env')
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env] || PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  })

  plaidClient = new PlaidApi(configuration)
  return plaidClient
}
