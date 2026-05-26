"use client";

import React from "react";
import { FIGMA_ASSETS } from "@/constants";
import type { PlayerEpisodeListItem } from "@/app/player/playerEpisodeListData";
import { chapterLabelForEpisodeListItem } from "@/lib/playerInfoEpisodes";

export type { PlayerEpisodeListItem };

interface PlayerEpisodeListStripProps {
  activeEpisodeId: number;
  items: PlayerEpisodeListItem[];
  onSelectEpisode: (item: PlayerEpisodeListItem) => void;
}

const BRAND = "#6503f8";
const THUMB_PLACEHOLDER = FIGMA_ASSETS.workThumbnail;

export function PlayerEpisodeListStrip({
  activeEpisodeId,
  items,
  onSelectEpisode,
}: PlayerEpisodeListStripProps) {
  return (
    <div className="episode-strip-root" role="region" aria-label="에피소드 목록">
      <div className="episode-strip-scroll">
        {items.map((item) => {
          const active = activeEpisodeId > 0 && item.id === activeEpisodeId;
          const thumbSrc =
            item.thumbnail.length > 0 ? item.thumbnail : THUMB_PLACEHOLDER;
          const epLabel = chapterLabelForEpisodeListItem(item);
          return (
            <button
              key={item.id}
              type="button"
              className={`episode-card${active ? " is-active" : ""}`}
              onClick={() => onSelectEpisode(item)}
            >
              <div className={`episode-thumb-wrap${active ? " is-active" : ""}`}>
                <img className="episode-thumb-img" src={thumbSrc} alt="" />
              </div>
              <div className={`episode-meta${active ? " is-active" : ""}`}>
                <span className="episode-ep">{epLabel}</span>
                <span className="episode-title">{item.title}</span>
              </div>
            </button>
          );
        })}
      </div>

      <style jsx>{`
        .episode-strip-root {
          width: 100vw;
          position: relative;
          left: 50%;
          transform: translateX(-50%);
          background: #f4f4f5;
          padding: 16px 0;
          overflow: hidden;
        }

        .episode-strip-scroll {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 16px;
          padding: 0 16px;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
        }

        .episode-card {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 6px;
          width: 84px;
          border: none;
          background: transparent;
          padding: 0;
          cursor: pointer;
          text-align: left;
        }

        .episode-thumb-wrap {
          position: relative;
          width: 100%;
          height: 50px;
          border-radius: 2px;
          overflow: hidden;
          border: 1px solid #e5e5e5;
          box-sizing: border-box;
        }

        .episode-thumb-wrap.is-active {
          border-color: ${BRAND};
        }

        .episode-thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .episode-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          line-height: normal;
          color: #333333;
        }

        .episode-meta.is-active {
          color: ${BRAND};
        }

        .episode-ep {
          font-weight: 700;
        }

        .episode-title {
          font-weight: 400;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (min-width: 769px) {
          .episode-card {
            width: 117.6px;
          }

          .episode-thumb-wrap {
            height: 70px;
          }

          .episode-meta {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}
