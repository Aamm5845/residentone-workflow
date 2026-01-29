import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_ENV === 'production'
        ? process.env.PLAID_SECRET_PRODUCTION
        : process.env.PLAID_SECRET_SANDBOX,
    },
  },
})

export const plaidClient = new PlaidApi(configuration)

// Create a link token for Plaid Link
export async function createLinkToken(userId: string, orgId: string) {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: 'StudioFlow by Meisner Interiors',
      products: [Products.Transactions],
      country_codes: [CountryCode.Ca, CountryCode.Us],
      language: 'en',
      // webhook: `${process.env.APP_URL}/api/plaid/webhook`, // TODO: Add webhook handling
    })

    return { linkToken: response.data.link_token }
  } catch (error: any) {
    console.error('Plaid createLinkToken error:', error.response?.data || error.message)
    throw new Error(error.response?.data?.error_message || 'Failed to create link token')
  }
}

// Exchange public token for access token
export async function exchangePublicToken(publicToken: string) {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    })

    return {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    }
  } catch (error: any) {
    console.error('Plaid exchangePublicToken error:', error.response?.data || error.message)
    throw new Error(error.response?.data?.error_message || 'Failed to exchange public token')
  }
}

// Get accounts for an item
export async function getAccounts(accessToken: string) {
  try {
    const response = await plaidClient.accountsGet({
      access_token: accessToken,
    })

    return {
      accounts: response.data.accounts,
      item: response.data.item,
    }
  } catch (error: any) {
    console.error('Plaid getAccounts error:', error.response?.data || error.message)
    throw new Error(error.response?.data?.error_message || 'Failed to get accounts')
  }
}

// Get institution details
export async function getInstitution(institutionId: string) {
  try {
    const response = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Ca, CountryCode.Us],
    })

    return response.data.institution
  } catch (error: any) {
    console.error('Plaid getInstitution error:', error.response?.data || error.message)
    return null
  }
}

// Get transactions for an item
export async function getTransactions(accessToken: string, startDate: string, endDate: string) {
  try {
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    })

    return {
      transactions: response.data.transactions,
      accounts: response.data.accounts,
      totalTransactions: response.data.total_transactions,
    }
  } catch (error: any) {
    console.error('Plaid getTransactions error:', error.response?.data || error.message)
    throw new Error(error.response?.data?.error_message || 'Failed to get transactions')
  }
}

// Get account balances
export async function getBalances(accessToken: string) {
  try {
    const response = await plaidClient.accountsBalanceGet({
      access_token: accessToken,
    })

    return {
      accounts: response.data.accounts,
    }
  } catch (error: any) {
    console.error('Plaid getBalances error:', error.response?.data || error.message)
    throw new Error(error.response?.data?.error_message || 'Failed to get balances')
  }
}

// Remove an item (disconnect bank)
export async function removeItem(accessToken: string) {
  try {
    await plaidClient.itemRemove({
      access_token: accessToken,
    })
    return true
  } catch (error: any) {
    console.error('Plaid removeItem error:', error.response?.data || error.message)
    throw new Error(error.response?.data?.error_message || 'Failed to remove item')
  }
}

// Sync transactions (for webhook handling - gets new transactions since last sync)
export async function syncTransactions(accessToken: string, cursor?: string) {
  try {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: cursor,
    })

    return {
      added: response.data.added,
      modified: response.data.modified,
      removed: response.data.removed,
      nextCursor: response.data.next_cursor,
      hasMore: response.data.has_more,
    }
  } catch (error: any) {
    console.error('Plaid syncTransactions error:', error.response?.data || error.message)
    throw new Error(error.response?.data?.error_message || 'Failed to sync transactions')
  }
}
