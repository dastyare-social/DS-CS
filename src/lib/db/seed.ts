import "dotenv/config";
import postgres from "postgres";

const connection = postgres(process.env.DATABASE_URL!, { max: 1 });

type SeedPost = {
  id: string;
  type: "text" | "image";
  content: string;
  media?: { url: string; width: number; height: number } | null;
  views: string;
  hoursAgo: number;
};

const POSTS: SeedPost[] = [
  {
    id: "seed-post-1-owned-vs-rented",
    type: "text",
    content: `I posted 400 times on a platform I don't own.

Then the algorithm changed, reach dropped 80%, and none of it mattered. Not the posts, not the followers, not the two years of consistency.

Here's the part that got me: every single one of those posts still exists. On their server. Indexed by their search, ranked by their rules, monetized by their ads.

I didn't own an audience. I was renting one.

So I stopped building on land I don't control. DS-CS is where I post now — my server, my domain, my rules. Nobody can throttle it, delete it, or sell ads next to it.

If your content is the asset, you should own the ground it sits on.`,
    views: "412",
    hoursAgo: 6 * 24,
  },
  {
    id: "seed-post-2-compounding-content",
    type: "text",
    content: `Most founder content has a shelf life of about 6 hours.

You post, it gets its window in the feed, then it's gone. Buried. Unsearchable. A stranger googling your name next week will never find it.

That's not a content problem. That's an infrastructure problem.

Every post on DS-CS gets indexed by search engines the same day it's published. Six months from now, someone searching the exact question you answered today still finds your answer. Not your competitor's recycled version of it. Yours.

Content should compound, not evaporate.`,
    views: "357",
    hoursAgo: 5 * 24,
  },
  {
    id: "seed-post-3-channel-style",
    type: "image",
    content: `A founder asked me last week why I don't just run a Telegram channel for my updates.

I do, actually. It just doesn't live on Telegram.

DS-CS renders text posts channel-style — same broadcast feel, same clean feed, one place people go to hear from you directly. The difference is it's on my domain, not a messaging app that could change its terms tomorrow.

You can have the format without the landlord.`,
    media: { url: "/seed/post-3-channel-style.png", width: 896, height: 896 },
    views: "289",
    hoursAgo: 4 * 24,
  },
  {
    id: "seed-post-4-shorts",
    type: "image",
    content: `Every short video you post lives on somebody else's app.

If your account gets flagged, restricted, or the platform just decides your niche isn't profitable this quarter, that catalog is gone. Not backed up anywhere you control. Just gone.

DS-CS has a shorts section — 1080x1920, same format your audience already scrolls — except it's served from your own storage, on your own domain. Same viewing experience, zero platform risk.

Build the habit people already have. Just stop building it on borrowed infrastructure.`,
    media: { url: "/seed/post-4-shorts.png", width: 896, height: 896 },
    views: "334",
    hoursAgo: 3 * 24,
  },
  {
    id: "seed-post-5-ai-agents",
    type: "text",
    content: `Here's a question most founders haven't asked yet: can an AI agent actually find and reference your content?

Not "is it on the internet." Can a language model, searching for an answer to a question you've already answered, actually discover your post, read it, and cite it.

Most content platforms weren't built for that. DS-CS was. Every post ships with a documented REST API, an OpenAPI spec, and an \`llms.txt\` file — a map built specifically for AI agents and search crawlers, not just human scrollers.

The next wave of discovery isn't only search engines. It's agents doing research on your behalf. Worth being findable by both.`,
    views: "268",
    hoursAgo: 2 * 24,
  },
  {
    id: "seed-post-6-open-source",
    type: "text",
    content: `I don't like paying rent on tools that hold my content hostage.

DS-CS is open source and free to use. No license fee, no seat limit, no "upgrade to export your own data" wall six months in. You run it, you own the database, you own the media, you own the decision to walk away without losing anything.

The pitch isn't "free forever." The pitch is: nobody can hold your audience over your head to raise the price later.`,
    views: "301",
    hoursAgo: 1 * 24,
  },
  {
    id: "seed-post-7-stories",
    type: "image",
    content: `Stories are supposed to be the low-effort, high-frequency layer of your presence. A quick update, a behind-the-scenes moment, gone in 24 hours by design.

Fine for the format. Not fine when the platform underneath it can vanish too.

DS-CS has stories — image and video, likes and views, same lightweight format people already expect. It just runs on infrastructure you control, so the habit doesn't come with a hidden dependency.`,
    media: { url: "/seed/post-7-stories.png", width: 896, height: 896 },
    views: "245",
    hoursAgo: 8,
  },
];

const REACTION_EMOJIS = [
  "❤️", "😂", "🔥", "👍", "👎", "😍", "😭", "🙏", "✨", "😮",
  "💯", "🥰", "😆", "😢", "👏", "🙌", "🤔", "💀", "🫶", "😎", "🎉",
] as const;

function randomReactions() {
  const count = 2 + Math.floor(Math.random() * 3); // 2–4 distinct emojis per post
  const picked = new Set<string>();
  while (picked.size < count) {
    picked.add(REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)]);
  }
  return [...picked].map((emoji) => ({
    emoji,
    count: 2 + Math.floor(Math.random() * 18), // 2–19
  }));
}

async function main() {
  console.log("🌱 Seeding demo posts...");

  // replace: clear reactions tied to old posts, then the posts themselves
  await connection`DELETE FROM reactions`;
  await connection`DELETE FROM posts`;

  for (const post of POSTS) {
    const createdAt = new Date(Date.now() - post.hoursAgo * 60 * 60 * 1000);
    await connection`
      INSERT INTO posts (id, type, content, views, media, created_at, updated_at)
      VALUES (${post.id}, ${post.type}, ${post.content}, ${post.views}, ${
        post.media ? JSON.stringify(post.media) : null
      }, ${createdAt}, ${createdAt})
      ON CONFLICT (id) DO NOTHING
    `;

    for (const { emoji, count } of randomReactions()) {
      await connection`
        INSERT INTO reactions (post_id, emoji, count, created_at, updated_at)
        VALUES (${post.id}, ${emoji}, ${count}, ${createdAt}, ${createdAt})
        ON CONFLICT (post_id, emoji) DO NOTHING
      `;
    }
  }

  const count = await connection`SELECT count(*)::int AS n FROM posts`;
  console.log(`✅ Inserted ${POSTS.length} seed posts (table now has ${count[0].n})`);
  await connection.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
