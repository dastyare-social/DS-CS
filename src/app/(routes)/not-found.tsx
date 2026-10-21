import { getTranslations } from "next-intl/server";
import NotFoundGetBackHomeButton from "@/components/not-found-get-back-home-button";

// Mirrors the global-not-found page for notFound() calls within routes
// (e.g. /about when disabled in about.config.yml).
//
// The description is set at 24px to match the Workshop project's not-found
// page, where the same line inherits `div { font-size: 24px }` from the base
// layer. This app has no such base rule, so the size is stated here.
const NotFound = async () => {
  const tNotFound = await getTranslations("not_found");

  return (
    <div className="w-full h-screen px-5 py-5 flex justify-center items-center">
      <div className="w-full md:max-w-xs flex flex-col justify-center items-center gap-y-5 px-5 py-5 rounded-3xl border-2 border-dashed border-primary/5 bg-primary/3">
        <div className="text-center text-2xl">{tNotFound("description")}</div>

        <NotFoundGetBackHomeButton />
      </div>
    </div>
  );
};

export default NotFound;
