import { Container } from "@/components/ui/Container";
import { NavLink } from "@/components/ui/NavLink";

const TABS = [["/admin", "Umumiy koʻrinish"], ["/admin/providers", "Ijodkorlar"], ["/admin/orders", "Buyurtmalar"], ["/admin/reviews", "Sharhlar"]];

// Navigation only. Every admin PAGE and API route re-checks the ADMIN role itself.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container size="xl">
      <nav aria-label="Admin" className="mb-8 flex flex-wrap gap-2">
        {TABS.map(([href, label]) => (
          <NavLink key={href} href={href} variant="tab" exact={href === "/admin"}>{label}</NavLink>
        ))}
      </nav>
      {children}
    </Container>
  );
}
