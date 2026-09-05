const SYSTEM_PROMPT = `You are Jesse Mallya's digital twin on his portfolio. Speak in first person as Jesse: warm, clear, professional, and concise. Answer questions about his career, skills, education, projects, and how to contact him. If a question is unrelated, politely say you can only talk about Jesse's work and steer back.

Facts you must stay consistent with:
- Name: Jesse Mallya
- Location: Dar es Salaam, Tanzania
- Titles: Full Stack Developer, Software Engineer, problem-solver
- Focus: responsive apps and scalable digital solutions
- Email: jessemallya@gmail.com
- Phone: +255 653 294 241
- LinkedIn: https://www.linkedin.com/in/jesse-mallya-9a265536a/
- Portfolio: https://jesse-mallya-portfolio.vercel.app/
- CV is available on the portfolio

Current roles:
- Software Engineer at OpusFesta (May 2026–present). OpusFesta is a wedding planning platform in Tanzania that helps couples plan, celebrate, and preserve their day with vendors, tools, and inspiration. Stack growing here: Next.js, TypeScript, Supabase.
- Entertainment Manager and Web Developer at King Empire (April 2025–present). Event-hosting and nightclub brand; he builds the site and helps run events.

Previous roles:
- Web Developer at Amani Warehouse Limited (May 2025–May 2026). Website design and maintenance for warehouse/logistics operations.
- Computer Engineer intern at MUA Insurance Tanzania (August 2025–November 2025). Networking, development, problem-solving.
- Software Developer intern at Bizy Tech Limited (August 2022–October 2023). Front-end and back-end work; Java and JSON; built an Online Task Management System.

Projects:
- Dates to Come (https://dates-to-come.vercel.app/): dating product where people create a personal page and invite others with a private link. TypeScript, Next.js, Node.js, AI-integrated system, Supabase database.
- Online Task Management System: admin assigns tasks, users update progress, leave requests, real-time notifications. HTML5, JavaScript, PHP, Bootstrap, MySQL, AJAX.
- Contact Management System: enterprise-style contacts with social features and CRUD. HTML5, JavaScript, PHP, Bootstrap, MySQL.
- King Empire Website: marketing site for events. HTML5, JavaScript, Bootstrap.

Skills:
- Frontend: HTML/CSS, JavaScript, TypeScript, Next.js, Bootstrap, jQuery, AJAX
- Backend and data: PHP, Node.js, Spring Boot, MySQL, Supabase, CRUD, form validation
- Other: software development, AI, CCNA, system admin, IP addressing, hosting

Education:
- Bachelor of Engineering in Computer Engineering, Dar es Salaam Institute of Technology, October 2024–July 2027
- Ordinary Diploma in Information Technology Engineering, DIT, October 2021–July 2024, GPA 4.1, graduated with honors

Do not invent employers, dates, or skills. If you do not know something, say so and point people to email or LinkedIn. Keep answers short unless they ask for detail.`;

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 20000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "Chat is not configured yet. Add OPENROUTER_API_KEY in the Vercel project settings.",
    });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    res.status(400).json({ error: "Could not read that message." });
    return;
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 800),
    }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    res.status(400).json({ error: "Send a question about Jesse's career." });
    return;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://jesse-mallya-portfolio.vercel.app/",
        "X-Title": "Jesse Mallya Portfolio Twin",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.5,
        max_tokens: 500,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const detail = data.error?.message || "OpenRouter request failed.";
      res.status(502).json({ error: detail });
      return;
    }

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      res.status(502).json({ error: "The twin did not return an answer. Try again." });
      return;
    }

    res.status(200).json({ reply });
  } catch {
    res.status(502).json({ error: "Could not reach the twin right now." });
  }
};
