const subscriptionRestrictionReasons = [
  'expired',
  'traffic_limit',
  'code_disabled',
  'invalid_code',
] as const

type SubscriptionRestrictionReason =
  (typeof subscriptionRestrictionReasons)[number]

export type AccessRestrictionReason =
  | SubscriptionRestrictionReason
  | 'device_limit'
  | 'bound_limit'
  | 'credential_rejected'
export type AccessRestriction = {
  accessCode: string
  reason: AccessRestrictionReason
}
export const isConfirmedSubscriptionRestriction = (
  code?: string,
): code is SubscriptionRestrictionReason =>
  subscriptionRestrictionReasons.some((reason) => reason === code)

export const parseAccessRestriction = (
  raw: string | null,
  accessCode: string,
): AccessRestriction | null => {
  try {
    const value = JSON.parse(raw || 'null') as AccessRestriction | null
    return value?.accessCode === accessCode &&
      (isConfirmedSubscriptionRestriction(value.reason) ||
        value.reason === 'device_limit' ||
        value.reason === 'bound_limit' ||
        value.reason === 'credential_rejected')
      ? value
      : null
  } catch {
    return null
  }
}
export const needsSubscriptionRefresh = (input: {
  startup: boolean
  recovering: boolean
  remoteVersion: number
  localVersion: number
  remoteRevision?: string
  localRevision?: string
  expiryChanged: boolean
}) =>
  input.startup ||
  input.recovering ||
  input.expiryChanged ||
  Boolean(
    input.remoteRevision && input.remoteRevision !== input.localRevision,
  ) ||
  input.remoteVersion > input.localVersion
