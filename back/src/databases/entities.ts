import { DddEvent } from '../libs/ddd';
import { Artist } from '../services/artists/domain/artist.entity';
import { Audio } from '../services/audios/domain/audio.entity';
import { Canvas } from '../services/canvases/domain/canvas.entity';
import { Character } from '../services/characters/domain/character.entity';
import { Cue } from '../services/cues/domain/cue.entity';
import { Episode } from '../services/episodes/domain/episode.entity';
import { Media } from '../services/medias/domain/media.entity';
import { Product } from '../services/products/domain/product.entity';
import { Record } from '../services/records/domain/record.entity';
import { Scroll } from '../services/scrolls/domain/scroll.entity';
import { Track } from '../services/tracks/domain/track.entity';

export default [DddEvent, Artist, Audio, Canvas, Character, Cue, Episode, Media, Product, Record, Scroll, Track];
