#!/usr/bin/env python3
"""Rebuild corrected demo media from the preserved 2026-08-14 package.

Usage: python3 scripts/retime-demo.py SOURCE_PACKAGE OUTPUT_PACKAGE
Requires ffmpeg/ffprobe. Does not modify inputs or publish anything.
The original TTS speed was 1.25; tempo 0.8 cancels that multiplier.
Video packets are copied with scaled timestamps; atempo preserves audio pitch.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

FACTOR = 1.25


def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)
    ]))


def retime_captions(text):
    def replace(match):
        h, m, s, sep, ms = match.groups()
        total = round((int(h) * 3600000 + int(m) * 60000 + int(s) * 1000 + int(ms)) * FACTOR)
        h, total = divmod(total, 3600000)
        m, total = divmod(total, 60000)
        s, ms = divmod(total, 1000)
        return f'{h:02}:{m:02}:{s:02}{sep}{ms:03}'
    return re.sub(r'(\d{2}):(\d{2}):(\d{2})([.,])(\d{3})', replace, text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = {'method': 'pitch-preserving retime of existing masters; no new TTS',
                'tempo': 0.8, 'timestamp_multiplier': FACTOR, 'languages': {}}
    for lang in ('it', 'en'):
        master = args.source / f'video/master/frontdoor-oss-demo-{lang}-1080p.mp4'
        preview = args.source / f'video/preview/frontdoor-oss-demo-{lang}-720p.mp4'
        duration = float(probe(master)['format']['duration']) * FACTOR
        outputs = {}
        for variant, video, bitrate in [('master', master, '192k'), ('web', preview, '80k')]:
            output = args.output / f'frontdoor-demo-{lang}-{variant}.mp4'
            if output.exists():
                raise FileExistsError(f'Refusing to overwrite {output}')
            command = ['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-n',
                       '-itsscale', str(FACTOR), '-i', str(video), '-i', str(master),
                       '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
                       '-af', 'atempo=0.8,apad', '-t', str(duration),
                       '-c:a', 'aac', '-b:a', bitrate, '-ar', '48000',
                       '-movflags', '+faststart', str(output)]
            subprocess.run(command, check=True)
            info = probe(output)
            actual = float(info['format']['duration'])
            assert abs(actual - duration) < 0.12, (actual, duration)
            if variant == 'web':
                assert 4 * ((output.stat().st_size + 2) // 3) + 128 < 10 * 1024 * 1024
            outputs[variant] = {'file': output.name, 'bytes': output.stat().st_size,
                                'duration': actual, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                                'command': command}
            print(lang, variant, outputs[variant]['bytes'], actual, flush=True)
        source_srt = args.source / f'subtitles/frontdoor-oss-demo-{lang}.srt'
        (args.output / f'frontdoor-demo-{lang}.srt').write_text(retime_captions(source_srt.read_text()))
        manifest['languages'][lang] = {'source_master_sha256': hashlib.sha256(master.read_bytes()).hexdigest(),
                                        'outputs': outputs}
    (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
