package com.sahwa.alarm;

import java.util.Random;

/**
 * Eight harsh alarm voices synthesized as PCM, mirroring the web app's voices.
 * Each call renders one 1.1 s beat.
 */
final class Voices {
    static final int COUNT = 8;
    static final int SR = 44100;
    private static final int SINE = 0, SQUARE = 1, SAW = 2, TRI = 3;

    private Voices() {}

    static short[] render(int voice, float p, float gain, Random rnd) {
        float[] b = new float[(int) (SR * 1.1)];
        switch (voice) {
            case 0: // siren
                sweep(b, 0, .45f, 600 * p, 1500 * p, .9f, SAW);
                sweep(b, .5f, .45f, 1500 * p, 600 * p, .9f, SAW);
                break;
            case 1: // rapid clicks
                for (int i = 0; i < 10; i++) tone(b, i * .075f, .045f, 1250 * p, 1f, SQUARE);
                break;
            case 2: // piercing chirps
                for (int i = 0; i < 4; i++) sweep(b, i * .2f, .08f, (2000 + i * 300) * p, (3400 + i * 200) * p, .7f, SINE);
                break;
            case 3: // clashing pair
                tone(b, 0, .85f, 440 * p, .6f, SQUARE);
                tone(b, 0, .85f, 466 * p, .6f, SQUARE);
                break;
            case 4: // rising ladder
                float[] m = {1, 1.25f, 1.5f, 2, 2.5f, 3};
                for (int i = 0; i < m.length; i++) tone(b, i * .12f, .12f, 440 * p * m[i], .9f, SAW);
                break;
            case 5: // classic alarm-clock beeps
                float[] w = {0, .13f, .26f, .39f, .62f, .75f, .88f};
                for (float s : w) tone(b, s, .09f, 2000 * p, .9f, SQUARE);
                break;
            case 6: // fire-alarm whoop
                sweep(b, 0, .9f, 500 * p, 1800 * p, .9f, SQUARE);
                break;
            default: // morse
                float t = 0;
                for (int i = 0; i < 6; i++) {
                    float d = rnd.nextBoolean() ? .06f : .2f;
                    if (t + d > 1.05f) break;
                    tone(b, t, d, 950 * p, .9f, SQUARE);
                    t += d + .06f;
                }
        }
        short[] out = new short[b.length];
        for (int i = 0; i < b.length; i++) {
            float v = Math.max(-1f, Math.min(1f, b[i])) * gain;
            out[i] = (short) (v * 32000);
        }
        return out;
    }

    private static float wave(int type, double ph) {
        double f = ph - Math.floor(ph);
        switch (type) {
            case SQUARE: return f < .5 ? 1f : -1f;
            case SAW: return (float) (2 * f - 1);
            case TRI: return (float) (1 - 4 * Math.abs(f - .5));
            default: return (float) Math.sin(2 * Math.PI * f);
        }
    }

    private static float env(int i, int n) {
        int attack = Math.min(n, SR / 200);
        if (i < attack) return i / (float) attack;
        return 1f - (i - attack) / (float) Math.max(1, n - attack);
    }

    private static void tone(float[] b, float start, float dur, float freq, float vol, int type) {
        sweep(b, start, dur, freq, freq, vol, type);
    }

    private static void sweep(float[] b, float start, float dur, float f1, float f2, float vol, int type) {
        int s = (int) (start * SR), n = (int) (dur * SR);
        double ph = 0;
        for (int i = 0; i < n && s + i < b.length; i++) {
            double f = f1 + (f2 - f1) * i / (double) n;
            ph += f / SR;
            b[s + i] += wave(type, ph) * vol * env(i, n) * .5f;
        }
    }
}
