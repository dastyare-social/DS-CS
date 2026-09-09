import Image from "next/image";
import { notFound } from "next/navigation";
import { getResumeConfig } from "@/config/resume";
import { Button } from "@/components/button";

// Read resume.config.yml per request so the enabled toggle applies live.
export const dynamic = "force-dynamic";

const Section = ({
  title,
  items,
}: {
  title: string;
  items: {
    title: string;
    subTitle?: string;
    date?: string;
    description?: string;
  }[];
}) => (
  <section className="my-5 text-md tracking-tight rounded-2xl border border-primary/10 bg-primary/[1%] px-4.5 py-3.5">
    <h3 className="mb-1 text-base text-secondary border-b border-primary/15 pb-1.5">
      {title} —
    </h3>
    <div className="flex flex-col">
      {items.map((item, index) => (
        <div
          className="flex pt-2.5 not-last:border-b not-last:border-primary/15 not-last:pb-5"
          key={index}
        >
          <div className="mr-8 max-w-[100px] w-full shrink-0 text-primary">
            {item.date}
          </div>
          <div className="flex flex-col flex-1">
            <h4 className="text-secondary">{item.title}</h4>
            {item.subTitle ? (
              <p className="text-secondary">{item.subTitle}</p>
            ) : null}
            {item.description ? (
              <p className="text-secondary mt-2">{item.description}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  </section>
);

const Page = () => {
  const resume_config = getResumeConfig();

  if (resume_config.enabled !== true || !resume_config.general?.name) {
    notFound();
  }

  const { general, content } = resume_config;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["ProfilePage", "AboutPage"],
    mainEntity: {
      "@type": "Person",
      name: general.name,
      ...(general.jobTitle ? { jobTitle: general.jobTitle } : {}),
      ...(general.avatar ? { image: general.avatar } : {}),
      ...(general.website ? { url: general.website } : {}),
      ...(general.contacts?.length
        ? {
            sameAs: general.contacts
              .map((contact) => contact.href)
              .filter(Boolean),
          }
        : {}),
    },
    about: general.about,
  };

  return (
    <main className="w-full max-w-xl mx-auto px-5 py-10 lg:px-10 lg:py-15 min-h-screen sm:border-x-2 border-secondary/5 pb-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="flex items-center gap-x-1.5">
        {general.avatar && (
          <Image
            alt={general.name}
            src={general.avatar}
            unoptimized
            width={120}
            height={120}
            priority
            className="rounded-full object-cover size-25 sm:size-30 border-2 border-primary/15 p-1"
          />
        )}
        <div className="ml-4">
          <h1 className="mb-0.5 text-2xl">{general.name}</h1>
          {general.jobTitle ? (
            <p className="text-xl text-secondary/80">{general.jobTitle}</p>
          ) : null}
          {general.website ? (
            <span className="text-lg text-primary">
              <a
                href={general.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary/80"
              >
                {general.website
                  .replace(/(^\w+:|^)\/\//, "")
                  .replace("www.", "")}
              </a>
            </span>
          ) : null}
        </div>
      </section>

      {general.about && (
        <section className="my-6 text-md tracking-tight rounded-2xl border border-primary/5 bg-primary/3 px-4.5 py-3.5">
          <h3 className="mb-1 text-base text-primary border-b border-primary/15 pb-1.5">
            About —
          </h3>
          <div className="text-secondary pt-1.5">
            <p>{general.about}</p>
          </div>

          {general.contacts?.length && (
            <div className="flex flex-wrap gap-2 pt-5">
              {general.contacts.map((contact, index) => (
                <a
                  key={index}
                  href={contact.href || "#"}
                  target={contact.href ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="px-2.5 py-0.5 rounded-full border border-primary/10 bg-primary/3 hover:bg-primary/10 transition-colors text-primary hover:text-primary text-sm"
                >
                  {contact.label} — {contact.value}
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {(content || []).map((section, index) => (
        <Section key={index} title={section.title} items={section.items} />
      ))}

      <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-xl w-full z-50">
        <div className="flex gap-x-1.5 sm:gap-x-2 px-4 pb-3 lg:pb-5 justify-center items-center">
          <Button
            variant="primary"
            asChild
            className="text-sm md:text-sm px-3.5 py-1.5 backdrop-blur-3xl text-nowrap"
          >
            <a href="/">View My Channel</a>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default Page;
