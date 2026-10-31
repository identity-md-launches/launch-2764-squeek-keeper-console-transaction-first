import { formatEther, getAddress } from 'viem'

export const short = (address: string) => `${getAddress(address).slice(0, 6)}…${address.slice(-4)}`
export function amount(value: bigint, digits = 4) {
  const text = formatEther(value)
  const [whole, fraction = ''] = text.split('.')
  if (value > 0n && Number(text) < 10 ** -digits) return `< ${10 ** -digits}`
  return `${BigInt(whole).toLocaleString('en-US')}${fraction && digits ? `.${fraction.slice(0, digits).replace(/0+$/, '')}`.replace(/\.$/, '') : ''}`
}
export const integer = (value: bigint | number) => value.toLocaleString('en-US')
export const date = (time: number) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(time) + ' UTC'
export function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/reject|denied|4001/i.test(message)) return 'Request declined in your wallet. You can try again.'
  if (/insufficient funds|exceeds the balance/i.test(message)) return 'Not enough Sepolia ETH for gas. Add test ETH, then try again.'
  if (/RoundNotSettled/i.test(message)) return 'Another keeper may have processed these rounds. Refresh the desk and try again.'
  if (/reverted|revert/i.test(message)) return 'The contract rejected the simulation. Refresh balances and approvals, then review the action again.'
  if (/timeout|timed out|fetch|HTTP|network/i.test(message)) return 'The network read failed. Check your connection and retry.'
  return message.split('\n')[0].slice(0, 240) || 'The request failed. Refresh and try again.'
}
