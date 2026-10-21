"use client";

import { useRouter } from "next/navigation";
import { Button } from "./button";
import { useTranslations } from "next-intl";
import { useState } from "react";

/*
    —— used on global-not-found.tsx ——

    The label is 24px to match the Workshop project's not-found page, whose
    button carries `text-[24px]`. This app's Button already scales with the
    viewport (`text-xl md:text-2xl`), so the size is pinned here to keep the
    two not-found pages in step.
*/
const NotFoundGetBackHomeButton = () => {
  const [is_clicked, set_is_clicked] = useState(false);

  const router = useRouter();

  const tNotFound = useTranslations("not_found");

  return (
    <Button
      disabled={is_clicked}
      className="mb-2 text-2xl"
      onClick={() => {
        set_is_clicked(true);
        router.push("/");
        router.refresh();
      }}
    >
      {tNotFound("back_to_home")}
    </Button>
  );
};

export default NotFoundGetBackHomeButton;
