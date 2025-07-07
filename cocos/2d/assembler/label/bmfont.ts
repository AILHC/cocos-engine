/*
 Copyright (c) 2017-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import { Color } from '../../../core';
import type { IBatcher } from '../../renderer/i-batcher';
import type { Label } from '../../components/label';
import type { IAssembler } from '../../renderer/base';
import { fillMeshVertices3D } from '../utils';
import { BmfontUtils } from './bmfontUtils';
import type { RenderData } from '../../renderer/render-data';
import { Node } from '../../../scene-graph/node';

const tempColor = new Color(255, 255, 255, 255);
const tempColor0 = new Color(255, 255, 255, 255);
const tempColor2: { r: number, g: number, b: number, a: number } = { r: 0, g: 0, b: 0, a: 0 };

const fillMeshVertices3D_BmfOutline = function (node: Node, renderer: any, cmp: any, r: number, g: number, b: number, a: number): void {
    const renderData = cmp.renderData!;
    const chunk = renderData.chunk;
    const dataList = renderData.data;
    const vData = chunk.vb;
    const vertexCount = renderData.vertexCount;

    // if (node.hasChangedFlags || renderData.dataDirty === 1) {

    const m = node.worldMatrix; // node.getWorldMatrix(m);
    const m00 = m.m00; const m01 = m.m01; const m02 = m.m02; const m03 = m.m03;
    const m04 = m.m04; const m05 = m.m05; const m06 = m.m06; const m07 = m.m07;
    const m12 = m.m12; const m13 = m.m13; const m14 = m.m14; const m15 = m.m15;

    let vertexOffset = 0;
    for (let i = 0; i < vertexCount; i++) {
        const vert = dataList[i];
        const x = vert.x;
        const y = vert.y;
        let rhw = m03 * x + m07 * y + m15;
        rhw = rhw ? 1 / rhw : 1;
        vData[vertexOffset + 0] = (m00 * x + m04 * y + m12) * rhw;
        vData[vertexOffset + 1] = (m01 * x + m05 * y + m13) * rhw;
        vData[vertexOffset + 2] = (m02 * x + m06 * y + m14) * rhw;
        //Color.toArray(vData, color, vertexOffset + 5);
        //const scale = (a instanceof Color || a.a > 1) ? 1 / 255 : 1;
        vData[vertexOffset + 5] = r;
        vData[vertexOffset + 6] = g;
        vData[vertexOffset + 7] = b;
        vData[vertexOffset + 8] = a;

        vertexOffset += 9;
    }

    // }

    // fill index data
    const bid = chunk.bufferId;
    const vid = chunk.vertexOffset;
    const meshBuffer = chunk.meshBuffer;
    const ib = chunk.meshBuffer.iData;
    let indexOffset = meshBuffer.indexOffset;

    for (let i = 0, count = vertexCount / 4; i < count; i++) {
        const start = vid + i * 4;
        ib[indexOffset++] = start;
        ib[indexOffset++] = start + 1;
        ib[indexOffset++] = start + 2;
        ib[indexOffset++] = start + 1;
        ib[indexOffset++] = start + 3;
        ib[indexOffset++] = start + 2;
    }
    meshBuffer.setDirty();
    meshBuffer.indexOffset += renderData.indexCount;
};

/**
 * bmfont 组装器
 * 可通过 `UI.bmfont` 获取该组装器。
 */
class Bmfont extends BmfontUtils implements IAssembler {
    createData (comp: Label): RenderData {
        const renderData = comp.requestRenderData();
        renderData.resize(0, 0);
        return renderData;
    }

    fillBuffers (comp: Label, renderer: IBatcher): void {
        const node = comp.node;

        if (comp.usingBmfOutline) {
            tempColor0.set(comp.color);
            tempColor0.a = node._uiProps.opacity * 255;

            tempColor2.r = -1;
            tempColor2.g = this.pack3ChannelToFloat(tempColor0.r, tempColor0.g, tempColor0.b);
            tempColor2.b = this.pack3ChannelToFloat(comp.bmfOutlineColor.r, comp.bmfOutlineColor.g, comp.bmfOutlineColor.b);
            tempColor2.a = this.pack2AlphaToFloat(tempColor0.a, comp.bmfOutlineColor.a);

            fillMeshVertices3D_BmfOutline(node, renderer, comp, tempColor2.r, tempColor2.g, tempColor2.b, tempColor2.a);
        } else {
            tempColor.set(comp.color);
            tempColor.a = node._uiProps.opacity * 255;
            // Fill All
            fillMeshVertices3D(node, renderer, comp.renderData!, tempColor);
        }
    }
}

export const bmfont = new Bmfont();
