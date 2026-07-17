"use client";

type ReactionProps = {
  emoji: string;
  count: number;
  onClick?: () => void;
};

const Reaction = ({ emoji, count, onClick }: ReactionProps) => {
  return (
    <div
      onClick={onClick}
      className="rounded-full bg-primary/5 border border-primary/5 px-1 flex justify-center items-center text-primary cursor-pointer"
    >
      {emoji}&nbsp;&nbsp;
      {count > 1 && count}
    </div>
  );
};

export default Reaction;
