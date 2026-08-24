import Image from "next/image";
import { notFound } from "next/navigation";
import { getResumeConfig } from "@/config/resume";

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
  <section className="my-14 text-sm">
    <h3 className="mb-6 text-base">{title}</h3>
    <div className="flex flex-col gap-6">
      {items.map((item, index) => (
        <div className="flex" key={index}>
          <div className="mr-8 max-w-[100px] w-full shrink-0 text-secondary/60">
            {item.date}
          </div>
          <div className="flex flex-col flex-1">
            <h4 className="text-foreground">{item.title}</h4>
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

  return (
    <main className="w-full max-w-xl mx-auto px-6 py-20 min-h-screen">
      <section className="flex items-center">
        {general.avatar ? (
          <Image
            alt={general.name}
            src={general.avatar}
            unoptimized
            width={80}
            height={80}
            priority
            className="rounded-full object-cover size-20 border border-primary/5"
          />
        ) : null}
        <div className="ml-4">
          <h1 className="mb-0.5 text-xl text-foreground">{general.name}</h1>
          {general.jobTitle ? (
            <p className="text-sm text-primary">{general.jobTitle}</p>
          ) : null}
          {general.website ? (
            <span className="text-sm text-secondary/60">
              <a
                href={general.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-secondary hover:underline"
              >
                {general.website.replace(/(^\w+:|^)\/\//, "").replace("www.", "")}
              </a>
            </span>
          ) : null}
        </div>
      </section>

      {general.about ? (
        <section className="my-9 text-sm">
          <h3 className="mb-1 text-base">About</h3>
          <div className="text-secondary">
            <p>{general.about}</p>
          </div>
        </section>
      ) : null}

      {general.contacts?.length ? (
        <section className="text-sm">
          <h3 className="mb-3 text-base">Contacts</h3>
          <div className="flex flex-wrap gap-2">
            {general.contacts.map((contact, index) => (
              <a
                key={index}
                href={contact.href || "#"}
                target={contact.href ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-full border border-primary/10 bg-primary/3 hover:bg-primary/10 transition-colors text-secondary hover:text-primary"
              >
                {contact.label} — {contact.value}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {(content || []).map((section, index) => (
        <Section key={index} title={section.title} items={section.items} />
      ))}
    </main>
  );
};

export default Page;
