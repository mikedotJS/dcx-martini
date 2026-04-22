import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useUser, useQuery, useMutation } from "@weirdscience/based-client";
import { based } from "./lib/based.js";
import {
  Plus,
  Minus,
  Trash2,
  Pencil,
  X,
  Wine,
  Calculator,
  BookOpen,
  Check,
  RotateCcw,
  Search,
  Download,
  Loader2,
} from "lucide-react";

/* ---------- Ingredient intelligence ---------- */

// Translate common EN names to FR at import time.
const TRANSLATIONS = {
  "light rum": "Rhum blanc",
  "white rum": "Rhum blanc",
  "dark rum": "Rhum ambré",
  "gold rum": "Rhum ambré",
  "rum": "Rhum",
  "vodka": "Vodka",
  "gin": "Gin",
  "tequila": "Tequila",
  "mezcal": "Mezcal",
  "whiskey": "Whisky",
  "whisky": "Whisky",
  "scotch": "Scotch",
  "bourbon": "Bourbon",
  "rye whiskey": "Rye",
  "brandy": "Brandy",
  "cognac": "Cognac",
  "sugar": "Sucre",
  "sugar syrup": "Sirop de sucre",
  "simple syrup": "Sirop de sucre",
  "gomme syrup": "Sirop de sucre",
  "lime juice": "Jus de citron vert",
  "fresh lime juice": "Jus de citron vert",
  "lemon juice": "Jus de citron",
  "orange juice": "Jus d'orange",
  "grapefruit juice": "Jus de pamplemousse",
  "cranberry juice": "Jus de canneberge",
  "pineapple juice": "Jus d'ananas",
  "tomato juice": "Jus de tomate",
  "lime": "Citron vert",
  "lemon": "Citron",
  "orange": "Orange",
  "fresh mint": "Menthe fraîche",
  "mint": "Menthe",
  "mint leaves": "Menthe",
  "basil": "Basilic",
  "ice": "Glace",
  "soda water": "Eau gazeuse",
  "club soda": "Eau gazeuse",
  "sparkling water": "Eau gazeuse",
  "tonic water": "Tonic",
  "ginger ale": "Ginger ale",
  "ginger beer": "Ginger beer",
  "bitters": "Bitters",
  "angostura bitters": "Angostura",
  "peychaud bitters": "Peychaud's",
  "sweet vermouth": "Vermouth rouge",
  "red vermouth": "Vermouth rouge",
  "dry vermouth": "Vermouth sec",
  "vermouth": "Vermouth",
  "triple sec": "Triple sec",
  "cointreau": "Cointreau",
  "grand marnier": "Grand Marnier",
  "campari": "Campari",
  "aperol": "Aperol",
  "amaretto": "Amaretto",
  "kahlua": "Kahlúa",
  "baileys irish cream": "Baileys",
  "champagne": "Champagne",
  "prosecco": "Prosecco",
  "cream": "Crème",
  "egg white": "Blanc d'œuf",
  "salt": "Sel",
  "water": "Eau",
  "coca-cola": "Coca-Cola",
  "cola": "Cola",
  "lemonade": "Limonade",
  "grenadine": "Grenadine",
};

function translateIngredient(name) {
  if (!name) return "";
  const key = name.trim().toLowerCase();
  return TRANSLATIONS[key] || name.trim();
}

// Categories drive the shopping-list format.
const CATEGORY_META = {
  spirit:    { bottleMl: 700, bottleLabel: "70 cl",  noun: "bouteille" },
  vermouth:  { bottleMl: 750, bottleLabel: "75 cl",  noun: "bouteille" },
  liqueur:   { bottleMl: 700, bottleLabel: "70 cl",  noun: "bouteille" },
  sparkling: { bottleMl: 750, bottleLabel: "75 cl",  noun: "bouteille" },
  soda:      { bottleMl: 1000, bottleLabel: "1 L",   noun: "bouteille" },
  syrup:     { bottleMl: 700, bottleLabel: "70 cl",  noun: "bouteille" },
  bitters:   { bottleMl: 200, bottleLabel: "20 cl",  noun: "flacon" },
  citrus:    { yieldMl: 30,   pieceLabel: "pièce",   noun: "pièce" },
  herb:      { yieldCount: 30, pieceLabel: "bouquet", noun: "bouquet" },
  pantry:    {},
  other:     {},
};

function categorize(rawName) {
  // Normalize NFC so decomposed accents (e + U+0301) match precomposed regex literals.
  const n = (rawName || "").normalize("NFC").toLowerCase();
  if (/\b(gin|vodka|rhum|rum|ron|whiske?y|tequila|mezcal|cognac|brandy|bourbon|scotch|rye|pisco|cacha[çc]a|aquavit|aguardiente|grappa|calvados|eau[- ]de[- ]vie)\b/.test(n)) return "spirit";
  if (/vermouth|lillet|dubonnet|byrrh|porto|port wine|red wine|white wine|vin rouge|vin blanc/.test(n)) return "vermouth";
  if (/prosecco|champagne|cava|cr[ée]mant|mousseux|vin mousseux/.test(n)) return "sparkling";
  if (/tonic|ginger beer|ginger ale|schweppes|eau gazeuse|eau p[ée]tillante|club soda|sparkling water|soda water|coca|cola|limonade|lemonade|soda pamplemousse|grapefruit soda/.test(n)) return "soda";
  if (/sirop|syrup|grenadine|orgeat|cordial|honey mix|donn's mix/.test(n)) return "syrup";
  // Liqueur runs before bitters: brand names like "Campari Bitter" / "Fernet Branca"
  // would otherwise match the generic `bitter` keyword and land in the 20 cl flacon bucket.
  if (/campari|aperol|triple sec|cointreau|chartreuse|kahl[uú]a|amaretto|amaro|marasquin|maraschino|falernum|fernet|schnapps|passoa|pernod|b[eé]n[eé]dictine|grand marnier|liqueur|limoncello|cura[çc]ao|frangelico|sambuca|baileys|cr[eè]me de|galliano|drambuie|j[aä]germeister|absinthe|pastis|ricard|suze|chambord/.test(n)) return "liqueur";
  if (/bitter|angostura|peychaud/.test(n)) return "bitters";
  if (/jus (de|d')\s*(citron|lime|orange|pamplemousse|canneberge|ananas|tomate|p[eê]che|fraise)/.test(n)) return "syrup";
  if (/^(citron|citron vert|lime|lemon|orange|pamplemousse|grapefruit)s?$/.test(n.trim())) return "citrus";
  if (/menthe|mint|basilic|basil|thym|thyme|romarin|rosemary|coriandre|cilantro|gingembre/.test(n)) return "herb";
  if (/sucre|sugar|sel|salt|poivre|pepper|cannelle|cinnamon|muscade|nutmeg|œuf|egg|cr[eè]me|cream|lait|milk|miel|honey|worcestershire|tabasco|vanille|vanilla|caf[eé]|espresso|pur[eé]e|eau$|water$|glace$|ice$/.test(n)) return "pantry";
  return "other";
}

/* ---------- Unit helpers ---------- */

function toMl(amount, unit) {
  const u = (unit || "").toLowerCase().trim();
  if (u === "ml") return amount;
  if (u === "cl") return amount * 10;
  if (u === "l")  return amount * 1000;
  if (u === "oz") return amount * 29.5735;
  if (u === "dash" || u === "dashes" || u === "trait" || u === "traits") return amount * 0.8;
  if (u === "tsp" || u === "c.c." || u === "c. à café" || u === "cuillère à café") return amount * 5;
  if (u === "tbsp" || u === "c.s." || u === "c. à soupe" || u === "cuillère à soupe") return amount * 15;
  return null;
}

const fmt = (n) => {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace(/\.0$/, "");
};

function formatMl(ml, displayUnit = "ml") {
  if (displayUnit === "shot") return `${fmt(ml / 30)} shot`;
  if (displayUnit === "oz") return `${fmt(ml / 29.5735)} oz`;
  if (ml >= 1000) return `${fmt(ml / 1000)} L`;
  if (ml >= 10 && ml % 10 === 0) return `${fmt(ml / 10)} cl`;
  return `${fmt(ml)} ml`;
}

function formatAmount(amount, unit, displayUnit = "ml") {
  if (unit === "ml" && displayUnit === "shot") return `${fmt(amount / 30)} shot`;
  if (unit === "ml" && displayUnit === "oz") return `${fmt(amount / 29.5735)} oz`;
  if (unit === "ml" && amount >= 1000) return `${fmt(amount / 1000)} L`;
  return `${fmt(amount)} ${unit}`;
}

// Parse TheCocktailDB's free-form measure strings.
function parseMeasure(raw) {
  if (!raw) return { amount: 1, unit: "unité" };
  let s = raw.trim().toLowerCase();

  // TheCocktailDB measures occasionally use ranges ("2-3 oz", "1-2 shot", "2 or 3").
  // Collapse to the upper bound so the shopping list errs on not running out.
  const range = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:[-–—]|\bor\b|\bto\b)\s*(\d+(?:[.,]\d+)?)(.*)$/);
  if (range) s = `${range[2]}${range[3] || ""}`;

  const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { amount: 1, unit: s || "unité" };

  const numStr = m[1];
  const rest = (m[2] || "").trim();
  let amount;
  if (numStr.includes(" ")) {
    const [w, frac] = numStr.split(/\s+/);
    const [n, d] = frac.split("/").map(Number);
    amount = parseInt(w, 10) + n / d;
  } else if (numStr.includes("/")) {
    const [n, d] = numStr.split("/").map(Number);
    amount = n / d;
  } else {
    amount = parseFloat(numStr.replace(",", "."));
  }

  if (/\boz\b|\bounce/.test(rest))          return { amount: Math.round(amount * 29.5735), unit: "ml" };
  if (/\bcl\b/.test(rest))                  return { amount: amount * 10, unit: "ml" };
  if (/\bml\b/.test(rest))                  return { amount, unit: "ml" };
  if (/\bl\b|\bliter/.test(rest))           return { amount: amount * 1000, unit: "ml" };
  if (/dash/.test(rest))                    return { amount, unit: "traits" };
  if (/tsp|teaspoon/.test(rest))            return { amount, unit: "c.c." };
  if (/tbsp|tablespoon/.test(rest))         return { amount, unit: "c.s." };
  if (/shot/.test(rest))                    return { amount: amount * 30, unit: "ml" };
  if (/\bpart\b/.test(rest))                return { amount: amount * 30, unit: "ml" };
  if (/leaf|leaves|feuille/.test(rest))     return { amount, unit: "feuilles" };
  if (/slice|wedge|tranche|quartier/.test(rest)) return { amount, unit: "tranche" };
  if (/twist|zest|zeste/.test(rest))        return { amount, unit: "zeste" };
  if (/cube/.test(rest))                    return { amount, unit: "morceau" };
  if (/drop|goutte/.test(rest))             return { amount, unit: "gouttes" };
  if (/sprig|brin/.test(rest))              return { amount, unit: "brin" };
  if (/cup|tasse/.test(rest))               return { amount: amount * 240, unit: "ml" };
  if (!rest)                                return { amount, unit: "unité" };

  return { amount, unit: rest.slice(0, 16) };
}

/* ---------- Catalog / API layer ---------- */

const COCKTAILDB_API = "https://www.thecocktaildb.com/api/json/v1/1";

function foldAccents(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function searchCatalog(query) {
  const q = foldAccents(query.trim());
  if (!q) return [];

  // Bundled IBA classics ship with the app. Loaded lazily so the main bundle
  // doesn't pay the ~40 KB cost until the user opens the Import modal.
  const { default: IBA_CATALOG } = await import("./data/iba-cocktails.json");
  const local = IBA_CATALOG
    .filter((c) => foldAccents(c.name).includes(q))
    .map((c) => ({
      id: `iba-${c.id}-${Math.random().toString(36).slice(2, 6)}`,
      name: c.name,
      ingredients: c.ingredients.map((i) => ({ ...i })),
    }));

  // TheCocktailDB for the long tail — tolerate failure so local hits still render.
  let remote = [];
  try {
    const res = await fetch(
      `${COCKTAILDB_API}/search.php?s=${encodeURIComponent(query.trim())}`
    );
    if (res.ok) {
      const { drinks } = await res.json();
      remote = (drinks || []).map(drinkToCocktail);
    }
  } catch {}

  // Dedupe by folded name, prefer the IBA entry (curated specs, metric units).
  const seen = new Set(local.map((c) => foldAccents(c.name)));
  return [...local, ...remote.filter((c) => !seen.has(foldAccents(c.name)))];
}

function drinkToCocktail(drink) {
  const ingredients = [];
  for (let i = 1; i <= 15; i++) {
    const name = drink[`strIngredient${i}`];
    if (!name || !name.trim()) continue;
    const rawMeasure = drink[`strMeasure${i}`];
    const parsed = parseMeasure(rawMeasure);
    ingredients.push({
      name: translateIngredient(name),
      amount: parsed.amount,
      unit: parsed.unit,
    });
  }
  return {
    id: `cdb-${drink.idDrink}-${Math.random().toString(36).slice(2, 6)}`,
    name: drink.strDrink,
    ingredients,
  };
}


/* ---------- Shopping list builder ---------- */

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function buildShoppingList(cocktails, selection, displayUnit = "ml") {
  const items = new Map();

  cocktails.forEach((c) => {
    const n = selection[c.id] || 0;
    if (n === 0) return;
    c.ingredients.forEach((ing) => {
      const key = normalizeName(ing.name);
      if (!items.has(key)) {
        items.set(key, {
          displayName: ing.name,
          category: categorize(ing.name),
          mlTotal: 0,
          others: new Map(),
        });
      }
      const item = items.get(key);
      const totalAmount = ing.amount * n;
      const ml = toMl(totalAmount, ing.unit);
      if (ml !== null) {
        item.mlTotal += ml;
      } else {
        item.others.set(ing.unit, (item.others.get(ing.unit) || 0) + totalAmount);
      }
    });
  });

  const rows = [];
  for (const item of items.values()) {
    const meta = CATEGORY_META[item.category] || {};
    const row = { name: item.displayName, category: item.category, main: "", detail: "" };

    if (meta.bottleMl && item.mlTotal > 0) {
      const bottles = Math.ceil(item.mlTotal / meta.bottleMl);
      row.main = `${bottles} × ${meta.bottleLabel}`;
      row.detail = `${formatMl(item.mlTotal, displayUnit)} utilisés`;
    } else if (item.category === "citrus" && item.mlTotal > 0) {
      const pieces = Math.ceil(item.mlTotal / meta.yieldMl);
      row.main = `${pieces} ${pieces > 1 ? "pièces" : "pièce"}`;
      row.detail = `${formatMl(item.mlTotal, displayUnit)} de jus`;
    } else if (item.category === "citrus" && item.others.size > 0) {
      const totalPieces = [...item.others.values()].reduce((a, b) => a + b, 0);
      row.main = `${fmt(totalPieces)} ${totalPieces > 1 ? "pièces" : "pièce"}`;
      row.detail = [...item.others.entries()].map(([u, a]) => `${fmt(a)} ${u}`).join(" · ");
    } else if (item.category === "herb") {
      const feuilles = item.others.get("feuilles") || 0;
      const brins = item.others.get("brin") || 0;
      if (feuilles > 0) {
        const bunches = Math.max(1, Math.ceil(feuilles / meta.yieldCount));
        row.main = `${bunches} ${bunches > 1 ? "bouquets" : "bouquet"}`;
        row.detail = `${fmt(feuilles)} feuilles`;
      } else if (brins > 0) {
        row.main = `${fmt(brins)} ${brins > 1 ? "brins" : "brin"}`;
      } else {
        row.main = `1 bouquet`;
        if (item.mlTotal > 0) row.detail = formatMl(item.mlTotal, displayUnit);
      }
    } else {
      const parts = [];
      if (item.mlTotal > 0) parts.push(formatMl(item.mlTotal, displayUnit));
      for (const [u, a] of item.others.entries()) parts.push(`${fmt(a)} ${u}`);
      row.main = parts.join(" · ") || "—";
    }

    rows.push(row);
  }

  const catOrder = {
    spirit: 0, vermouth: 1, liqueur: 2, sparkling: 3, soda: 4,
    syrup: 5, bitters: 6, citrus: 7, herb: 8, pantry: 9, other: 10,
  };
  rows.sort((a, b) => {
    const oa = catOrder[a.category] ?? 99;
    const ob = catOrder[b.category] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name, "fr");
  });
  return rows;
}

const CATEGORY_LABELS = {
  spirit: "Spiritueux",
  vermouth: "Vermouth",
  liqueur: "Liqueurs",
  sparkling: "Effervescents",
  soda: "Sodas",
  syrup: "Sirops & jus",
  bitters: "Bitters",
  citrus: "Agrumes frais",
  herb: "Herbes",
  pantry: "Épicerie",
  other: "Autres",
};

/* ---------- Main component ---------- */

function safeParseIngredients(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const { user, isLoading: authLoading } = useUser();
  const {
    data: rows,
    isLoading: queryLoading,
    refetch,
  } = useQuery("cocktails", { enabled: !!user });

  const { mutate: createRow } = useMutation("cocktails", "create");
  const { mutate: updateRow } = useMutation("cocktails", "update");
  const { mutate: deleteRow } = useMutation("cocktails", "delete");

  const cocktails = useMemo(() => {
    if (!rows) return [];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ingredients: safeParseIngredients(r.ingredients),
    }));
  }, [rows]);

  const SELECTION_ID = "current";
  const { mutate: upsertState } = useMutation("app_state", "upsert");

  const [selection, setSelectionRaw] = useState({});
  const [selectionLoading, setSelectionLoading] = useState(true);
  const hydratedRef = useRef(false);
  const writeDebounceRef = useRef(null);

  useEffect(() => {
    if (!user || hydratedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await based.from("app_state").get(SELECTION_ID);
        if (cancelled || !row?.data) return;
        const parsed = JSON.parse(row.data);
        if (parsed && typeof parsed === "object") setSelectionRaw(parsed);
      } catch {
        /* 404 or parse error → keep default empty state */
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
          setSelectionLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setSelection = useCallback(
    (updater) => {
      setSelectionRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (hydratedRef.current) {
          clearTimeout(writeDebounceRef.current);
          writeDebounceRef.current = setTimeout(() => {
            upsertState({
              id: SELECTION_ID,
              data: JSON.stringify(next),
            }).catch(() => {});
          }, 500);
        }
        return next;
      });
    },
    [upsertState]
  );

  const [tab, setTab] = useState("calculator");
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const [displayUnit, setDisplayUnit] = useState(() => {
    try {
      const v = localStorage.getItem("display-unit");
      return v === "shot" || v === "oz" ? v : "ml";
    } catch {
      return "ml";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("display-unit", displayUnit);
    } catch {}
  }, [displayUnit]);

  const shoppingList = useMemo(
    () => buildShoppingList(cocktails, selection, displayUnit),
    [cocktails, selection, displayUnit]
  );

  const totalServings = Object.values(selection).reduce((a, b) => a + (b || 0), 0);

  const setQty = (id, n) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });
  };

  const resetSelection = () => setSelection({});

  const saveEditing = async () => {
    if (!editing.name.trim()) return;
    const ingredients = editing.ingredients
      .filter((i) => i.name.trim() && i.amount > 0)
      .map((i) => ({
        name: i.name.trim(),
        amount: Number(i.amount),
        unit: i.unit.trim() || "ml",
      }));
    if (ingredients.length === 0) return;

    const payload = {
      name: editing.name.trim(),
      ingredients: JSON.stringify(ingredients),
    };
    try {
      if (editing.id) {
        await updateRow({ id: editing.id, ...payload });
      } else {
        await createRow(payload);
      }
      refetch();
      setEditing(null);
    } catch {
      /* keep the modal open so the user can retry */
    }
  };

  const deleteCocktail = async (id) => {
    try {
      await deleteRow({ id });
      setSelection((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      refetch();
    } catch {}
  };

  if (authLoading || queryLoading || selectionLoading || !user) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const groupedList = shoppingList.reduce((acc, row) => {
    (acc[row.category] = acc[row.category] || []).push(row);
    return acc;
  }, {});

  return (
    <div
      className="min-h-screen bg-stone-950 text-stone-100"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <header className="border-b border-stone-800/60">
        <div className="max-w-6xl mx-auto px-6 py-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wine className="w-6 h-6 text-amber-400" strokeWidth={1.5} />
            <h1 className="font-display text-3xl font-semibold">DCX Martini</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 bg-stone-900/60 border border-stone-800 rounded-full p-0.5">
              <button
                onClick={() => setDisplayUnit("ml")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  displayUnit === "ml"
                    ? "bg-amber-500 text-stone-950"
                    : "text-stone-400 hover:text-stone-100"
                }`}
              >
                ml
              </button>
              <button
                onClick={() => setDisplayUnit("oz")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  displayUnit === "oz"
                    ? "bg-amber-500 text-stone-950"
                    : "text-stone-400 hover:text-stone-100"
                }`}
              >
                oz
              </button>
              <button
                onClick={() => setDisplayUnit("shot")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  displayUnit === "shot"
                    ? "bg-amber-500 text-stone-950"
                    : "text-stone-400 hover:text-stone-100"
                }`}
              >
                shot
              </button>
            </div>
            <nav className="flex gap-1 bg-stone-900/60 border border-stone-800 rounded-full p-1">
              <button
                onClick={() => setTab("calculator")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition ${
                  tab === "calculator" ? "bg-amber-500 text-stone-950" : "text-stone-400 hover:text-stone-100"
                }`}
              >
                <Calculator className="w-4 h-4" strokeWidth={2} />
                Calcul
              </button>
              <button
                onClick={() => setTab("library")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition ${
                  tab === "library" ? "bg-amber-500 text-stone-950" : "text-stone-400 hover:text-stone-100"
                }`}
              >
                <BookOpen className="w-4 h-4" strokeWidth={2} />
                Répertoire
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {tab === "calculator" ? (
          <div className="grid md:grid-cols-5 gap-8">
            <div className="md:col-span-3">
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="font-display text-xl font-semibold">Sélection</h2>
                {totalServings > 0 && (
                  <button
                    onClick={resetSelection}
                    className="text-xs text-stone-500 hover:text-amber-400 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Réinitialiser
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {cocktails.map((c) => {
                  const qty = selection[c.id] || 0;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border transition ${
                        qty > 0
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-stone-800 bg-stone-900/40 hover:border-stone-700"
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="font-display text-lg">{c.name}</div>
                        <div className="text-xs text-stone-500 truncate">
                          {c.ingredients.map((i) => i.name).join(" · ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setQty(c.id, qty - 1)}
                          disabled={qty === 0}
                          className="w-8 h-8 rounded-full border border-stone-700 text-stone-400 hover:border-amber-500 hover:text-amber-400 disabled:opacity-30 disabled:hover:border-stone-700 disabled:hover:text-stone-400 flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span
                          className={`w-6 text-center font-mono text-sm tabular-nums ${
                            qty > 0 ? "text-amber-400" : "text-stone-600"
                          }`}
                        >
                          {qty}
                        </span>
                        <button
                          onClick={() => setQty(c.id, qty + 1)}
                          className="w-8 h-8 rounded-full border border-stone-700 text-stone-400 hover:border-amber-500 hover:text-amber-400 flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="md:sticky md:top-6 bg-stone-900/60 border border-stone-800 rounded-xl p-6">
                <h2 className="font-display text-xl font-semibold mb-1">Liste de courses</h2>
                <p className="text-xs text-stone-500 mb-5">
                  {totalServings === 0
                    ? "Aucun cocktail sélectionné"
                    : `${totalServings} cocktail${totalServings > 1 ? "s" : ""} au total`}
                </p>

                {shoppingList.length === 0 ? (
                  <div className="text-sm text-stone-600 italic py-6 text-center">
                    Composez votre soirée avec les boutons +
                  </div>
                ) : (
                  <div className="space-y-5">
                    {Object.entries(groupedList).map(([cat, rows]) => (
                      <div key={cat}>
                        <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-2">
                          {CATEGORY_LABELS[cat] || cat}
                        </div>
                        <ul className="space-y-2">
                          {rows.map((r, i) => (
                            <li
                              key={i}
                              className="flex items-baseline justify-between gap-3 border-b border-stone-800/60 pb-2"
                            >
                              <div className="min-w-0">
                                <div className="text-stone-200 truncate">{r.name}</div>
                                {r.detail && (
                                  <div className="text-[11px] text-stone-500 mt-0.5">{r.detail}</div>
                                )}
                              </div>
                              <span className="font-mono text-sm text-amber-400 tabular-nums whitespace-nowrap">
                                {r.main}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h2 className="font-display text-xl font-semibold">
                Répertoire{" "}
                <span className="text-stone-500 font-normal text-base">({cocktails.length})</span>
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setImportOpen(true)}
                  className="flex items-center gap-2 bg-stone-900 border border-stone-700 text-stone-200 px-4 py-2 rounded-lg text-sm font-medium hover:border-amber-500 hover:text-amber-400"
                >
                  <Search className="w-4 h-4" />
                  Importer
                </button>
                <button
                  onClick={() =>
                    setEditing({
                      id: null,
                      name: "",
                      ingredients: [{ name: "", amount: 0, unit: "ml" }],
                    })
                  }
                  className="flex items-center gap-2 bg-amber-500 text-stone-950 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-400"
                >
                  <Plus className="w-4 h-4" />
                  Nouveau
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cocktails.map((c) => (
                <div
                  key={c.id}
                  className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <h3 className="font-display text-xl font-semibold">{c.name}</h3>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() =>
                          setEditing({ ...c, ingredients: c.ingredients.map((i) => ({ ...i })) })
                        }
                        className="p-1.5 rounded hover:bg-stone-800 text-stone-500 hover:text-amber-400"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteCocktail(c.id)}
                        className="p-1.5 rounded hover:bg-stone-800 text-stone-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {c.ingredients.map((ing, i) => (
                      <li
                        key={i}
                        className="flex items-baseline justify-between text-stone-400 gap-3"
                      >
                        <span className="truncate">{ing.name}</span>
                        <span className="font-mono text-xs text-stone-500 tabular-nums whitespace-nowrap">
                          {formatAmount(ing.amount, ing.unit, displayUnit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onPickDrink={(cocktail) => {
            setImportOpen(false);
            setEditing(cocktail);
          }}
        />
      )}

      {editing && (
        <EditModal
          editing={editing}
          setEditing={setEditing}
          onSave={saveEditing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* ---------- Import modal ---------- */

function ImportModal({ onClose, onPickDrink }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const drinks = await searchCatalog(query.trim());
      setResults(drinks);
    } catch (err) {
      setError(err.message || "Recherche impossible");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const pick = (cocktail) => {
    onPickDrink(cocktail);
  };

  return (
    <div
      className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-stone-900 border border-stone-800 rounded-xl max-w-xl w-full max-h-screen overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-stone-800 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Importer un cocktail</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Margarita, Negroni, Paloma…"
              autoFocus
              className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={runSearch}
              disabled={loading || !query.trim()}
              className="bg-amber-500 text-stone-950 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Chercher
            </button>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">
            Recherche live via{" "}
            <a
              href="https://www.thecocktaildb.com/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-amber-400"
            >
              TheCocktailDB
            </a>
            .
          </p>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {error && !loading && (
            <div className="text-sm text-red-400 py-6 text-center">
              {error}
            </div>
          )}
          {!error && results !== null && results.length === 0 && !loading && (
            <div className="text-sm text-stone-500 italic py-6 text-center">
              Aucun résultat pour « {query} »
            </div>
          )}
          {results && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => pick(c)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-stone-800 bg-stone-950/50 hover:border-amber-500/50 hover:bg-amber-500/5 text-left transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-lg truncate">{c.name}</div>
                      <div className="text-xs text-stone-500 truncate">
                        {c.ingredients.map((i) => i.name).join(" · ")}
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-stone-500 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results === null && !loading && (
            <div className="text-sm text-stone-600 italic py-6 text-center">
              Lance une recherche pour voir les résultats
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Edit modal ---------- */

function EditModal({ editing, setEditing, onSave, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-stone-900 border border-stone-800 rounded-xl max-w-lg w-full max-h-screen overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-xl font-semibold">
              {editing.id ? "Modifier" : "Nouveau cocktail"}
            </h3>
            <button onClick={onClose} className="text-stone-500 hover:text-stone-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-stone-500 uppercase tracking-wider mb-1.5">
                Nom
              </label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none"
                placeholder="Ex. Negroni"
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 uppercase tracking-wider mb-1.5">
                Ingrédients
              </label>
              <div className="space-y-2">
                {editing.ingredients.map((ing, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => {
                        const next = [...editing.ingredients];
                        next[i] = { ...next[i], name: e.target.value };
                        setEditing({ ...editing, ingredients: next });
                      }}
                      className="flex-1 min-w-0 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:border-amber-500 focus:outline-none"
                      placeholder="Ingrédient"
                    />
                    <input
                      type="number"
                      value={ing.amount || ""}
                      onChange={(e) => {
                        const next = [...editing.ingredients];
                        next[i] = { ...next[i], amount: Number(e.target.value) };
                        setEditing({ ...editing, ingredients: next });
                      }}
                      className="w-20 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:border-amber-500 focus:outline-none"
                      placeholder="Qté"
                    />
                    <input
                      type="text"
                      value={ing.unit}
                      onChange={(e) => {
                        const next = [...editing.ingredients];
                        next[i] = { ...next[i], unit: e.target.value };
                        setEditing({ ...editing, ingredients: next });
                      }}
                      className="w-20 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:border-amber-500 focus:outline-none"
                      placeholder="ml"
                    />
                    <button
                      onClick={() => {
                        const next = editing.ingredients.filter((_, j) => j !== i);
                        setEditing({
                          ...editing,
                          ingredients: next.length
                            ? next
                            : [{ name: "", amount: 0, unit: "ml" }],
                        });
                      }}
                      className="text-stone-600 hover:text-red-400 px-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setEditing({
                      ...editing,
                      ingredients: [
                        ...editing.ingredients,
                        { name: "", amount: 0, unit: "ml" },
                      ],
                    })
                  }
                  className="text-xs text-stone-500 hover:text-amber-400 flex items-center gap-1 pt-1"
                >
                  <Plus className="w-3 h-3" />
                  Ajouter un ingrédient
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-stone-400 hover:text-stone-100"
              >
                Annuler
              </button>
              <button
                onClick={onSave}
                className="flex items-center gap-2 bg-amber-500 text-stone-950 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-400"
              >
                <Check className="w-4 h-4" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
