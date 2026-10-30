import type { Category, SessionRecord, Settings } from "./store";
import type { Language } from "./i18n";
import type { CalendarEvent } from "./google";

// The web demo (built with VITE_DEMO=1 and published to GitHub Pages) opens
// with four weeks of made-up sessions so the dial, the Today ribbon and the
// analytics look lived in. It runs only in the browser: no desktop database,
// no Google Calendar, so a made-up calendar of meetings stands in for one.

export const DEMO = import.meta.env.VITE_DEMO === "1";
export const DEMO_KEY = "stint-demo";

/** Throws away the visitor's changes and starts again from the sample data. */
export function resetDemo(): void {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    // Nothing stored.
  }
  location.reload();
}

export const demoText: Record<Language, { label: string; note: string; reset: string; confirm: string }> = {
  en: {
    label: "Demo",
    note: "with sample sessions. Your changes stay in this browser.",
    reset: "Start over",
    confirm: "Start the demo over? Your changes will be replaced by the sample data.",
  },
  "pt-BR": {
    label: "Demonstração",
    note: "com sessões de exemplo. O que você mudar fica só neste navegador.",
    reset: "Recomeçar",
    confirm: "Recomeçar a demonstração? O que você mudou some e os dados de exemplo voltam.",
  },
};

type Plan = { categoryId: number; intentions: string[]; reflections: string[] };

const content: Record<Language, { categories: string[]; plans: Omit<Plan, "categoryId">[] }> = {
  en: {
    categories: ["Work", "Study", "Personal", "Reading"],
    plans: [
      {
        intentions: ["Write the project proposal", "Answer client emails", "Prepare the Monday slides", "Review the budget sheet", "Plan next sprint"],
        reflections: ["Got the hard part done first.", "Kept getting pinged on Slack.", "Finished earlier than planned!", ""],
      },
      {
        intentions: ["Spanish lesson 12", "Statistics exercises", "Watch the design course", "Flashcards review"],
        reflections: ["Finally understood standard deviation.", "Hard to focus after lunch.", ""],
      },
      {
        intentions: ["Sort out the photos", "Plan the weekend trip", "Pay the bills", "Clean the inbox"],
        reflections: ["Felt good to clear that off.", ""],
      },
      {
        intentions: ["Read two chapters", "Finish the novel", "Read the long article I saved"],
        reflections: ["Lost track of time, in a good way.", ""],
      },
    ],
  },
  "pt-BR": {
    categories: ["Trabalho", "Estudo", "Pessoal", "Leitura"],
    plans: [
      {
        intentions: ["Escrever a proposta do projeto", "Responder e-mails de clientes", "Preparar os slides de segunda", "Revisar a planilha de orçamento", "Planejar a próxima sprint"],
        reflections: ["Fiz a parte difícil primeiro.", "Muita notificação no Slack.", "Terminei antes do planejado!", ""],
      },
      {
        intentions: ["Aula 12 de espanhol", "Exercícios de estatística", "Assistir o curso de design", "Revisar flashcards"],
        reflections: ["Finalmente entendi desvio padrão.", "Difícil focar depois do almoço.", ""],
      },
      {
        intentions: ["Organizar as fotos", "Planejar a viagem do fim de semana", "Pagar as contas", "Limpar a caixa de entrada"],
        reflections: ["Que alívio tirar isso da lista.", ""],
      },
      {
        intentions: ["Ler dois capítulos", "Terminar o romance", "Ler o artigo longo que salvei"],
        reflections: ["Perdi a noção do tempo, no bom sentido.", ""],
      },
    ],
  },
};

const colors = ["#e8594f", "#4f8ee8", "#52b788", "#b27ae0"];
const MIN = 60_000;

/** Same numbers on every visit, so the demo always tells the same story. */
function random(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

/** Four weeks of focus sessions and breaks, ending a little before now. */
export function demoData(settings: Settings): { categories: Category[]; sessions: SessionRecord[]; settings: Settings } {
  const language: Language = navigator.language.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
  const c = content[language];
  const categories = c.categories.map((name, i) => ({ id: i + 1, name, color: colors[i] }));
  const rnd = random(7);
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const sessions: SessionRecord[] = [];
  const now = Date.now();
  const add = (s: Omit<SessionRecord, "id">) => {
    if (s.endedAt < now - 10 * MIN) sessions.push({ ...s, id: sessions.length + 1 });
  };

  for (let daysAgo = 27; daysAgo >= 0; daysAgo--) {
    const day = new Date();
    day.setDate(day.getDate() - daysAgo);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    let count = weekend ? Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 5);
    day.setHours(weekend ? 10 : 9, Math.floor(rnd() * 40), 0, 0);
    let at = day.getTime();
    // Today always has a few sessions done, finished shortly before the visit.
    if (daysAgo === 0) {
      count = 3;
      at = Math.max(at, now - 4 * 60 * MIN);
    }
    for (let i = 0; i < count; i++) {
      // Mornings lean to work, evenings to reading and personal things.
      const categoryIndex = weekend ? pick([2, 3, 3, 1]) : i < 3 ? pick([0, 0, 0, 1]) : pick([1, 2, 3, 0]);
      const plan = c.plans[categoryIndex];
      const planned = pick([25, 25, 30, 45, 50]) * MIN;
      // Most sessions run a bit over; a few are cut short.
      const focused = Math.max(10 * MIN, planned + Math.round((rnd() * 1.1 - 0.25) * 12) * MIN);
      const rating = rnd() < 0.15 ? 0 : pick([1, 2, 2, 3, 3, 3]);
      add({
        kind: "focus",
        intention: pick(plan.intentions),
        categoryId: categoryIndex + 1,
        startedAt: at,
        endedAt: at + focused,
        plannedMs: planned,
        focusedMs: focused,
        reflection: rating ? pick(plan.reflections) : "",
        rating,
      });
      at += focused;
      const brk = (i % 3 === 2 ? 15 : 5) * MIN;
      add({
        kind: "break",
        intention: "",
        categoryId: null,
        startedAt: at,
        endedAt: at + brk + Math.round(rnd() * 3) * MIN,
        plannedMs: brk,
        focusedMs: brk,
        reflection: "",
        rating: 0,
      });
      at += brk + (rnd() < 0.3 ? 60 + Math.round(rnd() * 60) : Math.round(rnd() * 20)) * MIN;
    }
  }
  // One of today's sessions had two tasks, switched with Next task partway through.
  const midnight = new Date().setHours(0, 0, 0, 0);
  const split = sessions.find((s) => s.kind === "focus" && s.startedAt >= midnight && s.focusedMs >= 30 * MIN);
  if (split && split.categoryId !== null) {
    const other = c.plans[split.categoryId - 1].intentions.find((i) => i !== split.intention) ?? split.intention;
    const firstMs = Math.round((split.focusedMs * 0.4) / MIN) * MIN;
    const partOf = split.startedAt;
    sessions.push({ ...split, id: sessions.length + 1, intention: other, endedAt: split.startedAt + firstMs, focusedMs: firstMs, reflection: "", partOf });
    Object.assign(split, { startedAt: split.startedAt + firstMs, focusedMs: split.focusedMs - firstMs, partOf });
  }
  return { categories, sessions, settings: { ...settings, language, dailyGoal: 5 } };
}

const meetings: Record<Language, { standup: string; oneOnOne: string; review: string; planning: string; dentist: string }> = {
  en: { standup: "Team standup", oneOnOne: "1:1 with Ana", review: "Design review", planning: "Sprint planning", dentist: "Dentist" },
  "pt-BR": { standup: "Daily do time", oneOnOne: "1:1 com a Ana", review: "Revisão de design", planning: "Planejamento da sprint", dentist: "Dentista" },
};

/** A week of meetings, repeated every week, for the demo's pretend calendar. */
export function demoEvents(from: number, to: number, language: Language): CalendarEvent[] {
  const m = meetings[language];
  const out: CalendarEvent[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  for (; day.getTime() < to; day.setDate(day.getDate() + 1)) {
    const dow = day.getDay();
    const at = (h: number, min: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min).getTime();
    const add = (key: string, title: string, start: number, minutes: number, color: string) =>
      out.push({
        id: `${key}-${day.getTime()}`,
        calendarId: "demo",
        title,
        untitled: false,
        color,
        start,
        end: start + minutes * MIN,
        allDay: false,
        writable: false,
        shared: false,
        recurring: false,
        joinUrl: null,
      });
    if (dow >= 1 && dow <= 5) add("standup", m.standup, at(9, 30), 15, "#7986cb");
    if (dow === 2 || dow === 4) add("one", m.oneOnOne, at(11, 0), 30, "#33b679");
    if (dow === 3) add("review", m.review, at(14, 0), 60, "#e67c73");
    if (dow === 5) add("planning", m.planning, at(15, 0), 90, "#7986cb");
    // One odd appointment in the middle of each month, to show something that isn't routine.
    if (day.getDate() === 15 || day.getDate() === 29) add("dentist", m.dentist, at(17, 30), 45, "#f6bf26");
  }
  return out.filter((e) => e.end > from && e.start < to);
}
