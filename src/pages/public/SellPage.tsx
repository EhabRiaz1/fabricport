import { Link } from 'react-router-dom'
import { PublicNav } from '@/components/layout/PublicNav'
import { ArrowUpRight } from 'lucide-react'

export default function SellPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PublicNav />
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-32 lg:px-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
          For Suppliers
        </p>
        <h1
          className="mt-4 font-display font-bold text-white tracking-tight"
          style={{ fontSize: 'clamp(40px, 7vw, 88px)', lineHeight: 0.95 }}
        >
          Sell surplus fabrics
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/50">
          List verified inventory on FabricPort, reach global buyers, and manage inquiries
          through a single supplier portal.
        </p>

        <div className="mt-14 grid gap-1 lg:grid-cols-2">
          <div className="clip-corner bg-[#E8E4DC] p-8 lg:p-10 text-[#0a0a0a]">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#0a0a0a]/50">
              New supplier
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
              Join the network
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#0a0a0a]/65">
              Create a supplier account, submit your catalogue for review, and publish
              once approved by the FabricPort team.
            </p>
            <Link
              to="/auth/register?role=supplier"
              className="mt-8 inline-flex items-center gap-2 bg-[#0a0a0a] px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-[#E8E4DC] transition-colors hover:bg-[#0a0a0a]/85"
            >
              Register as supplier
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="clip-corner border border-white/10 bg-white/[0.03] p-8 lg:p-10">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">
              Existing supplier
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white">
              Supplier portal
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/45">
              Manage inventory, respond to buyer inquiries, and submit new listing requests.
            </p>
            <Link
              to="/auth/login"
              className="mt-8 inline-flex items-center gap-2 border border-white/20 px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-white/70 transition-colors hover:border-white/40 hover:text-white"
            >
              Sign in
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
