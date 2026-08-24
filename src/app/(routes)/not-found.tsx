import { getTranslations } from "next-intl/server";
import NotFoundGetBackHomeButton from "@/components/not-found-get-back-home-button";

// Mirrors the global-not-found page for notFound() calls within routes
// (e.g. /resume when disabled in resume.config.yml).
const NotFound = async () => {
  const tNotFound = await getTranslations("not_found");

  return (
    <div className="w-full h-screen px-5 py-5 flex justify-center items-center">
      <div className="w-full md:max-w-xs flex flex-col justify-center items-center gap-y-5 px-5 py-5 rounded-3xl border-2 border-dashed border-primary/5 bg-primary/3">
        <div className="text-center">{tNotFound("description")}</div>

        <NotFoundGetBackHomeButton />
      </div>
    </div>
  );
};

export default NotFound;
