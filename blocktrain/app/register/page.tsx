export const dynamic = "force-static"

export default function RegisterPage() {
  const ensSrc = process.env.NEXT_PUBLIC_ENS_REGISTER_IFRAME_SRC || "https://sepolia.app.ens.domains/"
  const aadhaarSrc = process.env.NEXT_PUBLIC_ANON_AADHAAR_IFRAME_SRC || "https://anon-aadhaar.pse.dev/"

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1320px] mx-auto px-6 py-10">
        <h1 className="text-3xl font-semibold mb-6">Register</h1>
        <p className="text-muted-foreground mb-10">
          Use the widgets below to register your ENS domain and complete anonymous Aadhaar verification. If the embed is blocked by the provider, open the link in a new tab.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">ENS Domain Registration</h2>
              <a href={ensSrc} target="_blank" rel="noopener noreferrer" className="text-primary text-sm">Open in new tab</a>
            </div>
            <div className="rounded-lg overflow-hidden border">
              <iframe
                src={ensSrc}
                title="ENS Registration"
                className="w-full h-[720px] bg-background"
              />
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Anon Aadhaar Verification</h2>
              <a href={aadhaarSrc} target="_blank" rel="noopener noreferrer" className="text-primary text-sm">Open in new tab</a>
            </div>
            <div className="rounded-lg overflow-hidden border">
              <iframe
                src={aadhaarSrc}
                title="Anon Aadhaar Verification"
                className="w-full h-[720px] bg-background"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
