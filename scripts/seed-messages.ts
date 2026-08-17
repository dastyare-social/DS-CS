import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { posts } from "@/lib/db/schema/posts";
import { randomUUID } from "crypto";

const db = drizzle(process.env.DATABASE_URL as string);

const founderPosts = [
  {
    content: `I spent 3 years building on Twitter. 15K followers. Then the algorithm changed and my reach dropped 80% overnight.

That's when I realized: I don't have an audience. I have a leash.

If you're building your personal brand on social media, you're building on quicksand.`,
    createdAt: new Date("2025-01-10T09:00:00Z"),
  },
  {
    content: `Real talk: Your social media followers don't belong to you.

You can't email them directly.
You can't message them without platform restrictions.
You can't even guarantee they'll SEE your posts.

Your website subscribers? They're YOURS. No algorithm. No filters. No gatekeeping.

That's why I built Dastyare Social.`,
    createdAt: new Date("2025-01-14T14:30:00Z"),
  },
  {
    content: `I just ran a campaign on Dastyare Social. Published once, pushed to my website + email list + push notifications.

Result: 340 new subscribers in 48 hours. Zero ad spend. Zero algorithm dependency.

When you own your distribution, campaigns just work.`,
    createdAt: new Date("2025-01-18T11:15:00Z"),
  },
  {
    content: `The founder brand formula that actually works:

1. Build your home base (your website)
2. Collect subscribers (email + push + RSS)
3. Create content once, distribute everywhere
4. Run campaigns that YOU control

Social media is step 3, not step 1. Most founders get this backwards.`,
    createdAt: new Date("2025-01-22T10:00:00Z"),
  },
  {
    content: `A founder asked me: "Why can't I just use Substack or Medium?"

Because you don't own those platforms either.

With Dastyare Social, you host your own content, own your subscriber data, and control your distribution. No middleman. No rent.`,
    createdAt: new Date("2025-01-25T15:45:00Z"),
  },
  {
    content: `I deleted 3 social media apps from my phone last month.

Instead of scrolling for 2 hours, I spent that time writing one post on my website. That post brought in 12 new subscribers.

Quality > quantity. Ownership > reach.`,
    createdAt: new Date("2025-01-28T08:30:00Z"),
  },
  {
    content: `If you're a founder spending more than 2 hours/week on social media, you're doing it wrong.

Here's the math:
- 4 hours/week × 52 weeks = 208 hours/year
- That's 26 full working days

Imagine what you could build with 26 extra days.

Dastyare Social cuts your content time to 30 minutes/week. Publish once, distribute everywhere.`,
    createdAt: new Date("2025-02-01T12:00:00Z"),
  },
  {
    content: `Running a campaign on social media is like shouting into a hurricane.

Running a campaign on your own website is like sending a letter to people who actually asked to hear from you.

Which one sounds more effective?

Dastyare Social makes campaigns simple: publish, push, convert.`,
    createdAt: new Date("2025-02-04T16:15:00Z"),
  },
  {
    content: `Hot take: Social media metrics are vanity metrics.

10K followers means nothing if 2% see your posts.
500 likes means nothing if nobody clicks your link.
1K retweets means nothing if your website gets zero traffic.

Track what matters: subscribers, conversion rate, direct traffic.

Dastyare Social shows you the metrics that actually grow your business.`,
    createdAt: new Date("2025-02-07T10:45:00Z"),
  },
  {
    content: `I just onboarded a founder to Dastyare Social. She had 20K Twitter followers but couldn't reach them without paying for promoted tweets.

Within 2 weeks of using Dastyare Social:
- 800 email subscribers
- 200 push notification subscribers
- 15% conversion rate from visitor to subscriber

She said: "I finally feel like I own my audience."

That's the goal.`,
    createdAt: new Date("2025-02-10T14:00:00Z"),
  },
  {
    content: `The 3 biggest mistakes founders make with personal branding:

1. Building on rented land (social media only)
2. Optimizing for likes instead of subscribers
3. Creating content daily instead of strategically

Fix all three with Dastyare Social. Your website is your foundation. Everything else is amplification.`,
    createdAt: new Date("2025-02-13T09:30:00Z"),
  },
  {
    content: `A founder DM'd me: "I posted daily on LinkedIn for 6 months. Got 5K followers. Then I changed jobs and my engagement dropped to zero."

The algorithm doesn't care about you. Your website does.

Dastyare Social: Build on something you own.`,
    createdAt: new Date("2025-02-16T11:00:00Z"),
  },
  {
    content: `Campaign idea: "Founder Friday"

Every Friday, publish one insight from your week on Dastyare Social. Push to your subscribers. Done.

No hashtags. No threading. No algorithm games. Just pure value, delivered directly to people who care.

That's how you build a real brand.`,
    createdAt: new Date("2025-02-19T15:30:00Z"),
  },
  {
    content: `I'm not saying quit social media. I'm saying don't BUILD on social media.

Use it as a discovery tool.
Use it to amplify your message.
Use it to drive traffic back to YOUR website.

But never make it your home base. That's a house of cards.

Dastyare Social is your concrete foundation.`,
    createdAt: new Date("2025-02-22T10:15:00Z"),
  },
  {
    content: `The ROI of a personal website:

Every blog post you publish:
- Drives organic search traffic for years
- Builds your email list
- Establishes authority
- Converts visitors into customers

The ROI of a social media post:
- Gets likes for 24 hours
- Disappears into the algorithm void
- Builds someone else's platform

Choose wisely.`,
    createdAt: new Date("2025-02-25T13:45:00Z"),
  },
  {
    content: `Just shipped a new feature: Campaign Analytics.

Now you can see exactly how many subscribers, views, and conversions each campaign generates. No more guessing. No more vanity metrics.

Data-driven founder branding. That's Dastyare Social.`,
    createdAt: new Date("2025-02-28T09:00:00Z"),
  },
  {
    content: `Real talk about social media algorithms:

They exist to keep you on the platform longer.
They don't care about YOUR goals.
They throttle your reach to sell you ads.
They change without warning.

You're playing a game you can't win.

Play a different game. Build on your own terms. Dastyare Social.`,
    createdAt: new Date("2025-03-03T14:30:00Z"),
  },
  {
    content: `A founder asked: "How do I get more sales from my personal brand?"

Answer: Stop chasing followers. Start collecting subscribers.

100 engaged subscribers > 10K passive followers.

Dastyare Social helps you build the 100 that matter.`,
    createdAt: new Date("2025-03-06T11:45:00Z"),
  },
  {
    content: `I ran an experiment: Same content, same day, posted to Twitter and Dastyare Social.

Twitter: 200 impressions, 12 clicks, 2 signups
Dastyare Social: 800 subscribers notified, 85 clicks, 34 signups

When you own your distribution, you don't need the algorithm.`,
    createdAt: new Date("2025-03-09T10:00:00Z"),
  },
  {
    content: `The founder's unfair advantage:

Your personal brand. Your story. Your expertise.

No algorithm can take that away. No platform can throttle it. No competitor can replicate it.

Dastyare Social helps you own that advantage.`,
    createdAt: new Date("2025-03-12T16:00:00Z"),
  },
  {
    content: `3 campaigns to run on Dastyare Social this month:

1. "Founder Journey" — Share a weekly lesson from building your company
2. "Behind the Scenes" — Show what you're actually working on
3. "Ask Me Anything" — Collect questions, publish answers on your website

Each campaign: 1 post, 1 push notification, 1 email. That's it.`,
    createdAt: new Date("2025-03-15T09:30:00Z"),
  },
  {
    content: `If your personal brand strategy is "post daily on Twitter," that's not a strategy. That's a treadmill.

Real strategy:
1. Build your home base (Dastyare Social)
2. Collect subscribers (email, push, RSS)
3. Create once, distribute everywhere
4. Run campaigns that drive actual results

That's how founders win.`,
    createdAt: new Date("2025-03-18T13:15:00Z"),
  },
  {
    content: `Just talked to a founder who quit social media entirely.

He said: "I was spending 3 hours/day creating content for Twitter. Now I spend 1 hour/week on Dastyare Social. My subscriber count is the same, but my conversion rate is 10x higher."

Quality beats quantity every time.`,
    createdAt: new Date("2025-03-21T10:45:00Z"),
  },
  {
    content: `The personal branding mistake that costs founders thousands:

They create content for social media instead of their website.

Social media content has a 24-hour lifespan.
Website content has a 2-year lifespan (SEO).

Publish once on Dastyare Social. Let it work for you for years.`,
    createdAt: new Date("2025-03-24T14:00:00Z"),
  },
  {
    content: `I'm building Dastyare Social for the founder who:

• Wants to own their audience
• Is tired of algorithm dependency
• Values time over vanity metrics
• Believes in building on their own terms
• Wants to run campaigns that actually convert

If that's you, let's talk.`,
    createdAt: new Date("2025-03-27T09:15:00Z"),
  },
  {
    content: `Campaign playbook: "Product Launch"

Week 1: Teaser post on Dastyare Social → push to subscribers
Week 2: Deep-dive post → email to subscribers
Week 3: Launch announcement → push + email + social
Week 4: User stories → push + email

4 posts. 4 weeks. Maximum impact. Zero algorithm dependency.`,
    createdAt: new Date("2025-03-30T15:30:00Z"),
  },
  {
    content: `The social media illusion:

"I have 10K followers!" → 2% see your posts
"I went viral!" → 0.1% subscribed
"I got 1K likes!" → 3 people clicked your link

Vanity metrics are noise. Subscribers are signal.

Dastyare Social filters out the noise.`,
    createdAt: new Date("2025-04-02T11:00:00Z"),
  },
  {
    content: `A founder's time is their most valuable asset. Every minute spent on social media management is a minute not spent building product.

Dastyare Social automates:
• Content distribution
• Subscriber management
• Push notifications
• Campaign analytics

Reclaim your time. Build your brand. Own your future.`,
    createdAt: new Date("2025-04-05T10:30:00Z"),
  },
  {
    content: `The algorithm is not your friend. It changes without notice, throttles your reach to sell ads, and rewards controversy over substance.

You can't win at a game you don't control.

Build on your own terms. Dastyare Social.`,
    createdAt: new Date("2025-04-08T14:15:00Z"),
  },
  {
    content: `30 days of Dastyare Social. Results:

• 2,400 subscribers (email + push + RSS)
• 12 campaigns run
• 8% average conversion rate
• 0 hours spent on algorithm games

This is what building on your own terms looks like.`,
    createdAt: new Date("2025-04-11T09:45:00Z"),
  },
];

async function seed() {
  console.log("Seeding founder posts...");

  const values = founderPosts.map((c) => ({
    id: randomUUID(),
    type: "text" as const,
    content: c.content,
    views: "0",
    pinnedAt: null,
    media: null,
    createdAt: c.createdAt,
    updatedAt: c.createdAt,
  }));

  await db.insert(posts).values(values);

  console.log(`Seeded ${values.length} posts.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
