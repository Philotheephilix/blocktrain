import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function fetchDomains(address: string) {
  const encodedAddress = encodeURIComponent(address)
  // Mirror the working curl exactly (network=Sepolia)
  const curlCommand = `curl -sS 'https://durin.dev/api/get-domains?address=${encodedAddress}&network=Sepolia' \
    -H 'accept: */*' \
    -H 'accept-language: en-US,en;q=0.7' \
    -H 'priority: u=1, i' \
    -H 'referer: https://durin.dev/' \
    -H 'sec-ch-ua: "Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"' \
    -H 'sec-ch-ua-mobile: ?0' \
    -H 'sec-ch-ua-platform: "Linux"' \
    -H 'sec-fetch-dest: empty' \
    -H 'sec-fetch-mode: cors' \
    -H 'sec-fetch-site: same-origin' \
    -H 'sec-gpc: 1' \
    -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'`

  const { stdout } = await execAsync(curlCommand)
  let parsed: any
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return { domains: [], raw: stdout }
  }

  let domains: any[] = []
  if (Array.isArray(parsed)) domains = parsed
  else if (parsed && Array.isArray(parsed.domains)) domains = parsed.domains
  else if (parsed?.data && Array.isArray(parsed.data.domains)) domains = parsed.data.domains

  return { domains }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const addressParam = (searchParams.get('address') || '').toLowerCase()

    if (!addressParam) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400 }
      )
    }

    const { domains } = await fetchDomains(addressParam)
    return NextResponse.json(domains)
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to fetch ENS data',
        details: error?.message ?? String(error),
      },
      { status: 500 }
    )
  }
}
