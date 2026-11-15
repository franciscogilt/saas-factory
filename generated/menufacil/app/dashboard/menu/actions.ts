"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRestaurant, toMoneyInput } from "@/lib/menu";

const back = (q: Record<string, string>, anchor = "") => redirect(`/dashboard/menu?${new URLSearchParams(q)}${anchor}`);
const done = () => revalidatePath("/", "layout");

// ───────────── Categorías ─────────────
export async function addCategory(form: FormData) {
  const { supabase, user, restaurant } = await requireRestaurant();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 60) return back({ error: "Escribe el nombre de la categoría." });
  const { count } = await supabase.from("categories").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id);
  const { error } = await supabase.from("categories").insert({ user_id: user.id, restaurant_id: restaurant.id, name, position: count ?? 0 });
  if (error) return back({ error: "No se pudo crear la categoría." });
  done();
  back({ ok: `Categoría "${name}" creada. Añade sus productos.` });
}

export async function renameCategory(form: FormData) {
  const { supabase, user } = await requireRestaurant();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 60) return back({ error: "El nombre de la categoría no es válido." });
  await supabase.from("categories").update({ name }).eq("id", String(form.get("id"))).eq("user_id", user.id);
  done();
}

export async function deleteCategory(form: FormData) {
  const { supabase, user } = await requireRestaurant();
  await supabase.from("categories").delete().eq("id", String(form.get("id"))).eq("user_id", user.id);
  done();
  back({ ok: "Categoría eliminada junto con sus productos." });
}

// ───────────── Productos ─────────────
function parseProduct(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const price = toMoneyInput(form.get("price"));
  if (name.length < 2 || name.length > 80) return { error: "Escribe el nombre del producto." } as const;
  if ((description?.length ?? 0) > 200) return { error: "La descripción admite hasta 200 caracteres." } as const;
  if (!Number.isFinite(price) || price < 0) return { error: "El precio no es válido." } as const;
  return { name, description, price: Math.round(price * 100) / 100 } as const;
}

export async function addProduct(form: FormData) {
  const { supabase, user, restaurant } = await requireRestaurant();
  const categoryId = String(form.get("category_id"));
  const v = parseProduct(form);
  if ("error" in v) return back({ error: v.error! }, `#c-${categoryId}`);
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", categoryId);
  const { error } = await supabase.from("products").insert({
    ...v, user_id: user.id, restaurant_id: restaurant.id, category_id: categoryId, position: count ?? 0,
  });
  // P0001 = mensaje pensado para el usuario (p. ej., el límite del plan gratis)
  if (error) return back({ error: error.code === "P0001" ? error.message : "No se pudo añadir el producto." }, `#c-${categoryId}`);
  done();
  back({ ok: `"${v.name}" añadido.` }, `#c-${categoryId}`);
}

export async function updateProduct(form: FormData) {
  const { supabase, user } = await requireRestaurant();
  const v = parseProduct(form);
  if ("error" in v) return back({ error: v.error! });
  await supabase.from("products").update(v).eq("id", String(form.get("id"))).eq("user_id", user.id);
  done();
  back({ ok: "Producto actualizado." }, `#c-${String(form.get("category_id"))}`);
}

export async function toggleAvailable(form: FormData) {
  const { supabase, user } = await requireRestaurant();
  await supabase.from("products").update({ available: form.get("available") === "true" }).eq("id", String(form.get("id"))).eq("user_id", user.id);
  done();
}

export async function deleteProduct(form: FormData) {
  const { supabase, user } = await requireRestaurant();
  await supabase.from("products").delete().eq("id", String(form.get("id"))).eq("user_id", user.id);
  done();
}

/** Sube o baja un elemento intercambiando su posición con el vecino. */
export async function move(form: FormData) {
  const { supabase, user, restaurant } = await requireRestaurant();
  const table = form.get("table") === "categories" ? "categories" : "products";
  const id = String(form.get("id"));
  const dir = form.get("dir") === "up" ? -1 : 1;
  const scope = table === "categories"
    ? supabase.from("categories").select("id, position").eq("restaurant_id", restaurant.id)
    : supabase.from("products").select("id, position").eq("category_id", String(form.get("category_id")));
  const { data } = await scope.order("position").order("created_at");
  const list = (data ?? []) as { id: string; position: number }[];
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  // Renumera para evitar posiciones repetidas y luego intercambia.
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, k) => supabase.from(table).update({ position: k }).eq("id", x.id).eq("user_id", user.id)));
  done();
}
