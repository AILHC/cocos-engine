import { BUILD } from 'internal:constants';
import { BitmapFont } from '../../assets/bitmap-font';
import { Label } from '../../components';
import { error } from '../../../core/platform';

export class BmfontOutlineHelper {
    static isBmfontOutlineLable (txt: Label): boolean {
        const font = txt.font;
        if (font) {
            return font.isBmfontOutlineFont();
        }
        return false;
    }

    static hasInvalidChar (bitmapFont: BitmapFont, content: string): boolean {
        for (let i = 0; i < content.length; i++) {
            const char = content.charAt(i);
            if (char !== '\n' && char !== '\r') {
                let charCode = content.charCodeAt(i);
                if (charCode >= 55296 && charCode <= 56319) {
                    charCode = content.codePointAt(i) as any;
                    i++;
                }
                const letter = bitmapFont.fontDefDictionary.getLetter(`${charCode}`);
                if (!letter) {
                    if (!BUILD) {
                        error(`未包含的字符:${char}`);
                    }
                    return true;
                }
            }
        }
        return false;
    }
}
