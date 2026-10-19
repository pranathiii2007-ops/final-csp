import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Star, MapPin, MessageCircle, Loader2, ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/product/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Product — Community Makers' Market" },
      { name: "description", content: "View a handmade product from a local seller." },
    ],
  }),
  component: ProductPage,
});

type Product = {
  id: string; seller_id: string; name: string; price: number;
  description: string | null; image_url: string; area: string | null;
  discount_percent: number; created_at: string;
};
type Profile = {
  id: string;
  shop_name: string;
  brand_name?: string | null;
  logo_url?: string | null;
  description?: string | null;
  area: string | null;
  location?: string | null;
  phone: string | null;
  website?: string | null;
  social_links?: { whatsapp?: string; instagram?: string } | null;
};
type Review = { id: string; reviewer_name: string; rating: number; comment: string | null; created_at: string; reviewer_id: string };

function ProductPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: p } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    setProduct((p as Product) ?? null);
    if (p) {
      const [{ data: pr }, { data: rv }] = await Promise.all([
        supabase.from("profiles").select("id,shop_name,brand_name,logo_url,description,area,location,phone,website,social_links").eq("id", p.seller_id).maybeSingle(),
        supabase.from("reviews").select("*").eq("product_id", id).order("created_at", { ascending: false }),
      ]);
      setSeller((pr as Profile) ?? null);
      setReviews((rv ?? []) as Review[]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!product) return (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">Product not found</h1>
      <Link to="/marketplace" className="mt-6 inline-flex items-center gap-2 text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Back to marketplace</Link>
    </div>
  );

  const disc = product.discount_percent;
  const finalPrice = disc > 0 ? product.price * (1 - disc / 100) : product.price;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <Link to="/marketplace" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Marketplace
      </Link>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
          <img src={product.image_url} alt={product.name} className="aspect-square w-full object-cover" />
          {disc > 0 && <span className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground shadow-soft">-{disc}% OFF</span>}
        </div>

        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">{product.name}</h1>
          {seller && (
            <div className="mt-3 flex items-center gap-3">
              {seller.logo_url ? (
                <img src={seller.logo_url} alt={seller.brand_name || seller.shop_name} className="h-10 w-10 rounded-full object-cover border border-border" />
              ) : null}
              <div>
                <div className="font-semibold text-foreground">{seller.brand_name || seller.shop_name}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {seller.location || seller.area || "Local seller"}
                  {seller.website && (
                    <>
                      <span>·</span>
                      <a href={seller.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">Website</a>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-baseline gap-3">
            <div className="font-display text-4xl font-bold text-primary">₹{finalPrice.toFixed(0)}</div>
            {disc > 0 && <div className="text-xl text-muted-foreground line-through">₹{product.price.toFixed(0)}</div>}
          </div>

          {reviews.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-sm">
              <Star className="h-4 w-4 fill-mustard text-mustard" />
              <span className="font-semibold">{avg.toFixed(1)}</span>
              <span className="text-muted-foreground">({reviews.length} review{reviews.length === 1 ? "" : "s"})</span>
            </div>
          )}

          {product.description && <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-foreground/90">{product.description}</p>}

          <ContactForm productId={product.id} sellerId={product.seller_id} />
        </div>
      </div>

      <div className="mt-16 border-t border-border pt-10">
        <h2 className="font-display text-2xl font-semibold">Reviews</h2>
        <ReviewForm productId={product.id} user={user} onAdded={load} existing={user ? reviews.find(r => r.reviewer_id === user.id) : undefined} />
        <div className="mt-8 space-y-4">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
          ) : reviews.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.reviewer_name}</div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className={`h-4 w-4 ${idx < r.rating ? "fill-mustard text-mustard" : "text-muted-foreground/40"}`} />
                  ))}
                </div>
              </div>
              {r.comment && <p className="mt-2 text-sm leading-relaxed text-foreground/90">{r.comment}</p>}
              <div className="mt-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactForm({ productId, sellerId }: { productId: string; sellerId: string }) {
  const [buyerName, setBuyerName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!buyerName.trim() || !phone.trim() || !message.trim()) { setErr("Please fill all fields."); return; }
    setBusy(true);
    const { error } = await supabase.from("inquiries").insert({
      product_id: productId, seller_id: sellerId,
      buyer_name: buyerName.trim(), phone: phone.trim(), message: message.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSent(true);
  };

  if (sent) return (
    <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-sm">
      <div className="font-semibold text-primary">Message sent!</div>
      <p className="mt-1 text-muted-foreground">The seller will see your inquiry in their dashboard and reach out on the phone number you provided.</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-8 rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-primary" /> Interested? Contact the seller</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Your name" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      </div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Hi, I'm interested in this product…" className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <button type="submit" disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send inquiry
      </button>
    </form>
  );
}

function ReviewForm({ productId, user, onAdded, existing }: {
  productId: string;
  user: { id: string; email?: string } | null;
  onAdded: () => void;
  existing?: Review;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [name, setName] = useState(existing?.reviewer_name ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!user) return (
    <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
      <Link to="/auth" className="font-semibold text-primary hover:underline">Sign in</Link> to leave a review.
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const rn = (name.trim() || user.email?.split("@")[0] || "Anonymous").slice(0, 60);
    setBusy(true);
    const { error } = await supabase.from("reviews").upsert({
      product_id: productId, reviewer_id: user.id,
      reviewer_name: rn, rating, comment: comment.trim() || null,
    }, { onConflict: "product_id,reviewer_id" });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onAdded();
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 text-sm font-semibold">{existing ? "Update your review" : "Leave a review"}</div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, idx) => (
          <button key={idx} type="button" onClick={() => setRating(idx + 1)} aria-label={`Rate ${idx + 1}`}>
            <Star className={`h-6 w-6 ${idx < rating ? "fill-mustard text-mustard" : "text-muted-foreground/40"}`} />
          </button>
        ))}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
        className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Share your thoughts (optional)"
        className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <button type="submit" disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {existing ? "Update review" : "Post review"}
      </button>
    </form>
  );
}