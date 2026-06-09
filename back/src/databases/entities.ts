import { DddEvent } from '../libs/ddd';
import { TtsVoice } from '../services/TTS-voices/domain/tts-voice.entity';
import { Character } from '../services/characters/domain/character.entity';
import { Cue } from '../services/cues/domain/cue.entity';
import { Effect } from '../services/effects/domain/effect.entity';
import { Episode } from '../services/episodes/domain/episode.entity';
import { Media } from '../services/medias/domain/media.entity';
import { Product } from '../services/products/domain/product.entity';
import { Scroll } from '../services/scrolls/domain/scroll.entity';
import { Script } from '../services/scripts/domain/script.entity';
import { Track } from '../services/tracks/domain/track.entity';

export default [DddEvent, Character, Cue, Effect, Episode, Media, Product, Scroll, Script, Track, TtsVoice];
