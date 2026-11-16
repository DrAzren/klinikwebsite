"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/** Privacy-enhanced YouTube embed: nothing loads from Google until the visitor presses play. */
export function VideoEmbed({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [on, setOn] = useState(false);
  if (!/^[\w-]{6,20}$/.test(youtubeId)) return null;
  return (
    <div className="relative aspect-video overflow-hidden rounded-3xl bg-navy-900">
      {on ? (
        <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`} title={title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <button type="button" onClick={() => setOn(true)} className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-navy-700 to-navy-950 p-6 text-white">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-500 text-navy-950 transition group-hover:scale-110"><Play className="h-7 w-7 translate-x-0.5" /></span>
          <span className="text-center font-semibold">{title}</span>
        </button>
      )}
    </div>
  );
}
