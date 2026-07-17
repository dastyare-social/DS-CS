"use client";

import { Button } from "../button";

const NotifModal = () => {
  return (
    <div className="flex flex-col justify-center items-center gap-y-2.5 py-6 px-6 w-xs border border-secondary/5 min-h-70 rounded-3xl bg-background/50 backdrop-blur-3xl">
      <div className="flex flex-1 flex-col w-full justify-start">
        <div>
          See How to <span className="text-primary">Get More Sales —</span> Omid
          Shabab's Newsletter
        </div>
        <div className="text-sm opacity-80 mt-2">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore
          aperiam, doloribus culpa mollitia deleniti repellat laborum beatae
          fuga error voluptatibus temporibus itaque perferendis, esse eveniet
          ipsa a architecto placeat vel!
        </div>
      </div>

      <Button variant="primary" className="w-full text-sm md:text-sm">
        Send Me The Ebook
      </Button>
    </div>
  );
};

export default NotifModal;
