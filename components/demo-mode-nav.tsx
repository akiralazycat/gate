export default function DemoModeNav({ active }: { active: "vault" | "cipher" }) {
  return (
    <nav className="demo-mode-nav" aria-label="Demo access surface">
      <a href="/demo" className={active === "vault" ? "is-active" : ""} aria-current={active === "vault" ? "page" : undefined}>
        <span>01</span>
        VAULT
      </a>
      <a href="/demo/cipher" className={active === "cipher" ? "is-active" : ""} aria-current={active === "cipher" ? "page" : undefined}>
        <span>02</span>
        CIPHER
      </a>
    </nav>
  );
}
