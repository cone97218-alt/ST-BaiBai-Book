import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as settings from '@/api/settings';
import * as context from '@/st/context';
import type { STContext, STMessage } from '@/st/context';
import { memory } from './store';
import { createEmptyMemory, type MemNpc, type MemProtagonist, type MemScene } from './types';
import { buildStateInjectionText } from './inject';

function useChat(chat: STMessage[]) {
  const ctx = {
    chat,
    chatMetadata: {},
    name1: '林舟',
    name2: '艾琳',
    saveChat: vi.fn().mockResolvedValue(undefined),
    saveMetadataDebounced: vi.fn(),
    saveMetadata: vi.fn().mockResolvedValue(undefined),
    reloadCurrentChat: vi.fn().mockResolvedValue(undefined),
    getCurrentChatId: () => 'field-test',
  } as unknown as STContext;
  vi.spyOn(context, 'getContext').mockReturnValue(ctx);
  return ctx;
}

describe('角色属性细粒度注入测试', () => {
  beforeEach(() => {
    useChat([]);
    Object.assign(memory, createEmptyMemory());
    settings.apiSettings.summaryOnlyMode = false;
    settings.apiSettings.injection.protagonist = true;
    settings.apiSettings.injection.protagonistFields = {
      gender: true,
      age: true,
      identity: true,
      appearance: true,
      outfit: true,
      condition: true,
    };
    settings.apiSettings.injection.npcs = true;
    settings.apiSettings.injection.npcFields = {
      gender: true,
      age: true,
      title: true,
      relation: true,
      personality: true,
      desc: true,
      outfit: true,
      condition: true,
      location: true,
    };
    settings.apiSettings.injection.scenes = true;
    settings.apiSettings.injection.npcAffinity = false;

    memory.state.location = '钟楼';
    const scene: MemScene = {
      id: 'scene:钟楼',
      name: '钟楼',
      path: ['钟楼'],
      desc: '古老的钟楼',
      createdAt: 1,
      updatedAt: 1,
    };
    memory.scenes = [scene];

    const protagonist: MemProtagonist = {
      gender: '男',
      age: '24岁',
      identity: '侦探',
      appearance: '黑发黑瞳',
      outfit: '黑色大衣',
      condition: '轻度擦伤',
    };
    memory.protagonist = protagonist;

    const npc: MemNpc = {
      id: 'npc:艾琳',
      name: '艾琳',
      gender: '女',
      age: '22岁',
      title: '助手',
      relation: '得力搭档',
      personality: '冷静敏锐',
      desc: '金发碧眼，戴金丝眼镜',
      outfit: '白色风衣',
      condition: '精神饱满',
      location: '钟楼',
      important: false,
      follow: false,
      createdAt: 1,
      updatedAt: 1,
    };
    memory.npcs = [npc];
  });

  it('默认全部开启时，输出完整的主角与 NPC 信息', () => {
    const text = buildStateInjectionText();
    expect(text).toContain('林舟:');
    expect(text).toContain('性别:男');
    expect(text).toContain('外貌:黑发黑瞳');
    expect(text).toContain('着装:黑色大衣');
    expect(text).toContain('状态:轻度擦伤');

    expect(text).toContain('在场角色:');
    expect(text).toContain('艾琳');
    expect(text).toContain('性格:冷静敏锐');
    expect(text).toContain('金发碧眼');
    expect(text).toContain('着装:白色风衣');
    expect(text).toContain('状态:精神饱满');
  });

  it('仅勾选着装和状态时，主角与 NPC 仅注入着装与状态，不含外貌、性格、身份等', () => {
    // 关掉其他，只留着装和状态
    settings.apiSettings.injection.protagonistFields = {
      gender: false,
      age: false,
      identity: false,
      appearance: false,
      outfit: true,
      condition: true,
    };
    settings.apiSettings.injection.npcFields = {
      gender: false,
      age: false,
      title: false,
      relation: false,
      personality: false,
      desc: false,
      outfit: true,
      condition: true,
      location: false,
    };

    const text = buildStateInjectionText();

    // 主角验证
    expect(text).toContain('林舟:');
    expect(text).toContain('着装:黑色大衣');
    expect(text).toContain('状态:轻度擦伤');
    expect(text).not.toContain('性别:男');
    expect(text).not.toContain('外貌:黑发黑瞳');
    expect(text).not.toContain('身份:侦探');

    // NPC 验证
    expect(text).toContain('在场角色:');
    expect(text).toContain('艾琳');
    expect(text).toContain('〔着装:白色风衣;状态:精神饱满〕');
    expect(text).not.toContain('冷静敏锐');
    expect(text).not.toContain('金发碧眼');
    expect(text).not.toContain('助手');
    expect(text).not.toContain('得力搭档');
  });

  it('支持自定义注入前置上文字、后置下文字和标题', () => {
    settings.apiSettings.prompts.briefingNote = '【自定义上文：请遵守客观记忆】';
    settings.apiSettings.prompts.briefingEnd = '【自定义下文：记忆结束，继续对话】';
    settings.apiSettings.prompts.stateHeader = '【当前世界快照】';

    const text = buildStateInjectionText();
    expect(text).toContain('【自定义上文：请遵守客观记忆】');
    expect(text).toContain('【当前世界快照】');
    expect(text).toContain('【自定义下文：记忆结束，继续对话】');
  });

  it('填入 <none> 可完全禁用前置上文字与后置下文字', () => {
    settings.apiSettings.prompts.briefingNote = '<none>';
    settings.apiSettings.prompts.briefingEnd = '<none>';
    settings.apiSettings.prompts.stateHeader = '[纯状态]';

    const text = buildStateInjectionText();
    expect(text.startsWith('[纯状态]')).toBe(true);
    expect(text).not.toContain('私密简报');
    expect(text).not.toContain('MEMORY_BRIEFING');
  });

  it('支持自定义或隐藏主角及NPC名册各个子标题', () => {
    // 自定义子标题
    settings.apiSettings.prompts.briefingNote = '<none>';
    settings.apiSettings.prompts.briefingEnd = '<none>';
    settings.apiSettings.prompts.stateHeader = '<none>';
    settings.apiSettings.prompts.protagonistHeader = '【我方】';
    settings.apiSettings.prompts.npcsHeader = '【NPC列表】';
    settings.apiSettings.prompts.presentNpcHeader = '【在此处】';

    const text = buildStateInjectionText();
    expect(text).toContain('【我方】\n林舟:');
    expect(text).toContain('【NPC列表】');
    expect(text).toContain('【在此处】');
    expect(text).not.toContain('[主角当前状态]');
    expect(text).not.toContain('NPC名册:');
    expect(text).not.toContain('在场角色:');

    // 彻底隐藏子标题（全部设为 <none>）
    settings.apiSettings.prompts.protagonistHeader = '<none>';
    settings.apiSettings.prompts.npcsHeader = '<none>';
    settings.apiSettings.prompts.presentNpcHeader = '<none>';

    const textClean = buildStateInjectionText();
    expect(textClean).not.toContain('【我方】');
    expect(textClean).not.toContain('【NPC列表】');
    expect(textClean).not.toContain('【在此处】');
    expect(textClean).not.toContain('[主角当前状态]');
    expect(textClean).not.toContain('NPC名册:');
    expect(textClean).not.toContain('在场角色:');
    // 依然包含主角和艾琳的内容
    expect(textClean).toContain('林舟:');
    expect(textClean).toContain('艾琳');
  });
});
