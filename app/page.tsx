import { CalendarCheck2, BellRing, ShieldCheck, Smartphone, Users, BarChart3, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  return <>
    <header className="container nav">
      <a className="brand" href="/"><span className="brand-mark">L+</span><span>Rezervacije</span></a>
      <div className="nav-actions"><a className="btn" href="#mogucnosti">Mogućnosti</a><a className="btn btn-primary" href="/login">Prijava za salon <ArrowRight size={16}/></a></div>
    </header>
    <main>
      <section className="container hero">
        <div>
          <span className="eyebrow"><Sparkles size={14}/> Rezervacije bez telefonskog ping-ponga</span>
          <h1>Termin u nekoliko dodira. Salon pod potpunom kontrolom.</h1>
          <p>Mobile-first platforma za frizerske, beauty, masažne i wellness usluge. Klijenti vide samo stvarno slobodne termine, a tim dobiva kalendar, klijente, statistiku i automatske podsjetnike.</p>
          <div className="hero-actions"><a className="btn btn-brand" href="/book/demo-salon">Isprobaj rezervaciju <ArrowRight size={17}/></a><a className="btn" href="/login">Otvori administraciju</a></div>
        </div>
        <div className="hero-card"><div className="phone">
          <div className="phone-top"><div><small className="muted">Rezerviraj termin</small><h3 style={{margin:"3px 0 0"}}>Studio Lumina</h3></div><div className="avatar">SL</div></div>
          <div className="service-card"><div className="service-row"><div><strong>Žensko šišanje</strong><div className="muted" style={{fontSize:13,marginTop:4}}>45 min · Ana</div></div><strong>24 €</strong></div></div>
          <div style={{fontWeight:800,margin:"22px 0 10px"}}>Slobodni termini danas</div>
          <div className="slots"><span className="slot">09:00</span><span className="slot active">10:30</span><span className="slot">11:15</span><span className="slot">13:00</span><span className="slot">14:45</span><span className="slot">16:30</span></div>
          <div className="service-card" style={{marginTop:26,background:"#f9f9fc"}}><div className="service-row"><span className="muted">Odabrano</span><strong>10:30</strong></div><div className="service-row" style={{marginTop:12}}><span>Čet, 17. rujna</span><span>45 min</span></div></div>
          <button className="btn btn-primary" style={{width:"100%",marginTop:12}}>Nastavi</button>
        </div></div>
      </section>
      <section id="mogucnosti" className="container feature-grid">
        <Feature icon={<CalendarCheck2/>} title="Pametni kalendar" text="Slobodni slotovi računaju smjene, pauze, trajanje, pripremu, čišćenje i postojeće rezervacije."/>
        <Feature icon={<BellRing/>} title="Automatske obavijesti" text="Email i PWA push potvrde, podsjetnici i obavijesti o otkazivanju za salon i klijenta."/>
        <Feature icon={<ShieldCheck/>} title="Bez double-bookinga" text="Transakcijski slot-lockovi štite termin čak i kada ga dvije osobe pokušaju uzeti istovremeno."/>
        <Feature icon={<Smartphone/>} title="PWA na mobitelu" text="Instalira se na početni zaslon, radi kao aplikacija i šalje push obavijesti vlasniku i timu."/>
        <Feature icon={<Users/>} title="Više firmi i djelatnika" text="Svaka firma vidi isključivo svoje podatke, rasporede, djelatnike, usluge i klijente."/>
        <Feature icon={<BarChart3/>} title="Brojke koje imaju smisla" text="Termini, promet, popunjenost, no-show i aktivnost tima na jednom čistom dashboardu."/>
      </section>
    </main>
  </>;
}
function Feature({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){return <article className="feature"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>}
