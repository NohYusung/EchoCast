import { DddEvent } from '../libs/ddd';
import { Anchor } from '../services/anchors/domain/anchor.entity';
import { Artist } from '../services/artists/domain/artist.entity';
import { Audio } from '../services/audios/domain/audio.entity';
import { CanvasMedia } from '../services/canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../services/canvases/domain/canvas.entity';
import { Character } from '../services/characters/domain/character.entity';
import { Cue } from '../services/cues/domain/cue.entity';
import { Episode } from '../services/episodes/domain/episode.entity';
import { Media } from '../services/medias/domain/media.entity';
import { Pause } from '../services/pauses/domain/pause.entity';
import { Product } from '../services/products/domain/product.entity';
import { Record } from '../services/records/domain/record.entity';
import { Scroll } from '../services/scrolls/domain/scroll.entity';
import { Track } from '../services/tracks/domain/track.entity';

export default [
    DddEvent,
    Anchor,
    Artist,
    Audio,
    CanvasMedia,
    Canvas,
    Character,
    Cue,
    Episode,
    Media,
    Pause,
    Product,
    Record,
    Scroll,
    Track,
];
