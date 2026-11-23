import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import {
  MATERIALS,
  MODELS,
  STATIONS,
  ITEM_NAMES,
  MATERIAL_BY_ID,
  MATERIAL_SHORT,
  type MaterialId,
} from '@/sim/recipes'
import { activeOrder, evaluation, uph, yieldRate, starvedStations } from '@/sim/engine'
import { DIFFICULTIES } from '@/sim/difficulty'
import { binSlots, feed, feedBom, targetStationOf } from '@/sim/feed'
import { sim } from '@/sim/sim'
import { click, isMuted, onMutedChange, setMuted, thock, unlockAudio, whoosh } from '@/lib/sfx'
import { useFactory, type Speed, type ViewKey } from '@/store/useFactory'

const VIEW_BUTTONS: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'overview', label: '全景', icon: 'M3 9l9-6 9 6v10H3z' },
  { key: 'top', label: '俯视', icon: 'M4 12h16M12 4v16' },
  { key: 'side', label: '侧视', icon: 'M4 16h16M4 8h10' },
  { key: 'output', label: '出货区', icon: 'M4 8h16v11H4zM4 8l4-4h8l4 4' },
]

const STATE_LABEL = {
  working: '加工中',
  blocked: '下游阻塞',
  starved: '缺料',
  idle: '待料',
} as const

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export function Hud() {
  const lineState = useFactory((s) => s.lineState)
  const view = useFactory((s) => s.view)
  const speed = useFactory((s) => s.speed)
  const focusStationId = useFactory((s) => s.focusStationId)
  const focusId = useFactory((s) => s.focusProductId)
  const setFocusProduct = useFactory((s) => s.focusProduct)
  const drag = useFactory((s) => s.drag)
  const selected = useFactory((s) => s.selected)
  const toast = useFactory((s) => s.toast)

  const start = useFactory((s) => s.start)
  const togglePause = useFactory((s) => s.togglePause)
  const setSpeed = useFactory((s) => s.setSpeed)
  const setView = useFactory((s) => s.setView)
  const focusStation = useFactory((s) => s.focusStation)
  const reset = useFactory((s) => s.reset)
  const beginDrag = useFactory((s) => s.beginDrag)
  const moveDrag = useFactory((s) => s.moveDrag)
  const selectMaterial = useFactory((s) => s.selectMaterial)

  const version = useFactory((s) => s.simVersion)
  const guideStep = useFactory((s) => s.guideStep)
  const quality = useFactory((s) => s.quality)
  const advanceGuide = useFactory((s) => s.advanceGuide)
  const skipGuide = useFactory((s) => s.skipGuide)
  const cycleQuality = useFactory((s) => s.cycleQuality)
  const difficulty = useFactory((s) => s.difficulty)
  const cycleDifficulty = useFactory((s) => s.cycleDifficulty)
  const [help, setHelp] = useState(false)
  const [muted, setMutedState] = useState(isMuted)

  // 首次手势解锁音频
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    const off = onMutedChange(setMutedState)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      off()
    }
  }, [])

  // 引导推进：投料 → 启动 → 看到成品
  useEffect(() => {
    if (lineState === 'running') advanceGuide(2)
    if (sim.finished > 0 && guideStep < 3) skipGuide()
  }, [lineState, version, guideStep, advanceGuide, skipGuide])

  const dropBom = () => {
    const res = feedBom()
    if (res.moved) {
      thock()
      advanceGuide(1)
    }
    const store = useFactory.getState()
    store.bump()
    store.showToast(res.moved ? `按 BOM 配齐：投入 ${res.moved} 件` : '料仓已满或库存不足', res.moved ? 'ok' : 'warn')
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (useFactory.getState().drag) moveDrag(e.clientX, e.clientY)
    }
    const onUp = () => {
      const st = useFactory.getState()
      const d = st.drag
      if (!d) return
      // 必须真的落在画布上，避免在面板上松手误投
      const overCanvas = document.elementFromPoint(d.x, d.y)?.tagName === 'CANVAS'
      if (d.active && st.hoverBin != null && overCanvas) {
        const res = feed(st.hoverBin, d.material, 1)
        if (res.ok) {
          thock()
          advanceGuide(1)
          st.bump()
          st.showToast(`${MATERIAL_BY_ID[d.material].name} +1 → S${st.hoverBin}`, 'ok')
        } else if (res.reason === 'wrong-station') {
          st.showToast(`${MATERIAL_BY_ID[d.material].name} 不适用这个工站`, 'warn')
        } else if (res.reason === 'full') {
          st.showToast('料仓已满', 'warn')
        } else {
          st.showToast('仓库库存不足', 'warn')
        }
      } else if (!d.active) {
        st.selectMaterial(d.material)
      }
      st.endDrag()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [moveDrag])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHelp(false)
        selectMaterial(null)
      }
      if (e.key === '1') setView('overview')
      if (e.key === '2') setView('top')
      if (e.key === '3') setView('side')
      if (e.key === '4') setView('output')
      if (e.key === ' ') {
        e.preventDefault()
        if (useFactory.getState().lineState === 'idle') start()
        else togglePause()
      }
      if (e.key === 'f' || e.key === 'F') dropBom()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setView, start, togglePause, selectMaterial])

  const finished = sim.finished
  const defects = sim.defects
  const rate = yieldRate(sim)
  const actualUph = Math.round(uph(sim))
  const latest = sim.events[sim.events.length - 1]
  const focus = focusId != null ? sim.products.find((v) => v.id === focusId) : undefined
  const order = activeOrder(sim)
  const orderModel = order ? MODELS[order.model] : null
  const changeover = sim.changeover
  const remain = order ? Math.max(0, order.timeLimit - order.elapsed) : 0
  const urgent = order ? remain < 30 : false
  const fmt = (sec: number) => {
    const t = Math.max(0, Math.ceil(sec))
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }
  const starving = starvedStations(sim)
  const stockTotal = MATERIALS.reduce((n, m) => n + sim.stock[m.id], 0)
  void version

  const onRowDown = (e: ReactPointerEvent, m: MaterialId) => {
    e.preventDefault()
    beginDrag(m, e.clientX, e.clientY)
  }

  const quickFeed = (e: ReactPointerEvent, m: MaterialId) => {
    e.stopPropagation()
    e.preventDefault()
    const station = targetStationOf(m)
    const res = feed(station, m, 5)
    const store = useFactory.getState()
    store.bump()
    if (res.ok) {
      thock()
      advanceGuide(1)
      store.showToast(`${MATERIAL_BY_ID[m].name} +${res.moved} → S${station}`, 'ok')
    }
    else if (res.reason === 'full') store.showToast(`S${station} 料仓已满`, 'warn')
    else store.showToast('仓库库存不足', 'warn')
  }

  return (
    <div className="hud">
      <header className="brand">
        <div className="brand__mark">
          <span />
          <span />
          <span />
        </div>
        <div className="brand__text">
          <h1>
            iPhone 生产线 <em>3D</em>
          </h1>
          <p>
            智能工厂模拟 · 7 工站 · <b>全流程贯通</b>
          </p>
        </div>
      </header>

      <div className="statusbar">
        <div
          className={`pill pill--${
            changeover ? 'paused' : starving.length ? 'starved' : lineState === 'running' ? 'running' : lineState === 'paused' ? 'paused' : 'idle'
          }`}
        >
          <i />
          {changeover
            ? '换线中'
            : starving.length
            ? `${starving.slice(0, 2).map((id) => `S${id}`).join(' ')}${starving.length > 2 ? ` 等${starving.length}站` : ''} 缺料`
            : lineState === 'running'
              ? '生产中'
              : lineState === 'paused'
                ? '已暂停'
                : '待机中'}
        </div>
        <div className="stat">
          <span>成品</span>
          <b>{finished}</b>
        </div>
        <div className="stat">
          <span>不良</span>
          <b>{defects}</b>
        </div>
        <div className="stat">
          <span>良率</span>
          <b>{finished + defects === 0 ? '--' : `${(rate * 100).toFixed(1)}%`}</b>
        </div>
        <div className="stat stat--dim">
          <span>UPH</span>
          <b>{actualUph || '--'}</b>
        </div>
      </div>

      {changeover ? (
        <div className="changeover">
          <b>换线</b>
          <span>{MODELS[changeover.model].name}</span>
          <span className="changeover__bar">
            <i style={{ width: `${Math.min(100, (changeover.t / changeover.need) * 100)}%` }} />
          </span>
          <em>{Math.max(0, changeover.need - changeover.t).toFixed(1)}s</em>
        </div>
      ) : (
        latest && (
          <div className={`ticker ticker--${latest.kind}`} key={latest.id}>
            <i />
            {latest.text}
          </div>
        )
      )}

      <aside className={`orders${urgent ? ' is-urgent' : ''}`}>
        <div className="panel-head">
          <span>当前订单</span>
          <span className="orders__eval">评价 {evaluation(sim)}</span>
        </div>
        {order ? (
          <>
            <div className="orders__client">
              {order.client}
              <span className="orders__model" style={{ color: orderModel?.accent }}>
                {orderModel?.short}
              </span>
            </div>
            <div className="orders__count">
              <b>{order.delivered}</b>
              <span>/{order.qty} 台</span>
              <i>+{order.reward}</i>
            </div>
            <div className="orders__bar">
              <i style={{ width: `${Math.min(100, (order.delivered / order.qty) * 100)}%` }} />
            </div>
            <div className="orders__meta">
              <span className={urgent ? 'is-warn' : ''}>剩余 {fmt(remain)}</span>
              <span>积分 {sim.score}</span>
            </div>
          </>
        ) : (
          <div className="orders__client">等待接单…</div>
        )}
        <ul className="orders__queue">
          {sim.orders.slice(1).map((o) => (
            <li key={o.id}>
              <b>{o.client}</b>
              <span>
                {o.qty} 台 · {o.timeLimit}s
              </span>
            </li>
          ))}
        </ul>
      </aside>

      {guideStep < 3 && (
        <div className="guide">
          <b>{['①', '②', '③'][guideStep]}</b>
          <span className="guide__text">
            {
              [
                '先把「铝锭」拖进 S1 上方的料仓（也可以点原料行 +5，或按 F 一键配齐）',
                '点左下角「启动产线」，S1 会开始往传送带上放机壳',
                '手机会在 20 秒左右落到右侧货架，别让某个料仓见底',
              ][guideStep]
            }
          </span>
          <button className="guide__skip" onClick={() => { skipGuide(); click() }}>
            跳过
          </button>
        </div>
      )}

      {focus && (
        <aside className="product-card">
          <div className="product-card__head">
            <span>在制品 #{focus.id}</span>
            <button className="product-card__close" onClick={() => setFocusProduct(null)}>
              ×
            </button>
          </div>
          <div className="product-card__name">{ITEM_NAMES[focus.item]}</div>
          <div className="product-card__meta">
            <span className={`product-card__model`} style={{ color: MODELS[focus.model].accent }}>
              {MODELS[focus.model].short}
            </span>
            <span>阶段 {focus.stage}/7</span>
            <span>{(sim.time - focus.born).toFixed(1)}s</span>
          </div>
          <div className="product-card__bar">
            <i style={{ width: `${(focus.stage / 7) * 100}%` }} />
          </div>
          <div className="product-card__hint">镜头已跟随，可继续旋转缩放</div>
        </aside>
      )}

      <aside className="rail">
        <div className="rail__title">
          <span>产线工站</span>
          {sim.products.length > 0 ? (
            <button
              className="rail__follow"
              onClick={() => setFocusProduct(sim.products[0].id)}
              title="跟随线上第一件在制品"
            >
              {sim.products.length} 在制 · 跟随
            </button>
          ) : (
            <span className="rail__meta">0 在制</span>
          )}
        </div>
        <ul>
          {STATIONS.map((s) => {
            const st = sim.stations[s.id - 1]
            const active = focusStationId === s.id
            const slots = binSlots(s.id)
            const binText = slots.map((slot) => `${MATERIAL_SHORT[slot.id]}${st.bins[slot.id] ?? 0}`).join(' ')
            return (
              <li key={s.id}>
                <button
                  className={`station-card is-${st.state}${active ? ' is-active' : ''}`}
                  style={{ '--accent': s.accent } as CSSProperties}
                  onClick={() => focusStation(active ? null : s.id)}
                >
                  <span className="station-card__dot" />
                  <span className="station-card__code">{s.code}</span>
                  <span className="station-card__body">
                    <b>{s.name}</b>
                    <em>
                      {STATE_LABEL[st.state]}
                      {binText ? ` · ${binText}` : ''}
                    </em>
                  </span>
                  <span className="station-card__bin">
                    {st.produced}
                    <i> 件</i>
                  </span>
                  {st.state === 'working' && (
                    <i className="station-card__bar" style={{ width: `${Math.max(2, st.progress * 100)}%` }} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="rail__hint">料仓为 0 会红灯停线，补料自动复产；订单换机型时会自动换线 8s</div>
      </aside>

      <aside className="materials">
        <div className="panel-head">
          <span>原料仓库</span>
          <button className="btn btn--mini" onClick={dropBom} title="按单台 BOM 一次配齐（F）">
            按 BOM 配齐
          </button>
        </div>
        <ul>
          {MATERIALS.map((m) => {
            const stock = sim.stock[m.id]
            const isSel = selected === m.id
            const isDrag = drag?.active && drag.material === m.id
            return (
              <li
                key={m.id}
                className={`material-row${isSel ? ' is-selected' : ''}${isDrag ? ' is-dragging' : ''}`}
                onPointerDown={(e) => onRowDown(e, m.id)}
                title={`拖到 S${m.stationId} 的料仓；单击选中后再点料仓也可以`}
              >
                <span className="material-row__swatch" style={{ background: m.color, color: m.color }} />
                <span className="material-row__name">
                  {m.name}
                  <i>×{m.unit}</i>
                </span>
                <span className="material-row__dest">S{m.stationId}</span>
                <span className="material-row__stock">{stock}</span>
                <button className="material-row__add" onPointerDown={(e) => quickFeed(e, m.id)}>
                  +5
                </button>
              </li>
            )
          })}
        </ul>
        <div className="materials__hint">
          库存合计 <b>{stockTotal}</b> 件 · 拖拽原料到工站上方料仓，或先点选原料再点料仓
        </div>
      </aside>

      <div className="dock">
        <div className="dock__group">
          {lineState === 'idle' ? (
            <button
              className={`btn btn--primary${guideStep === 1 ? ' is-pulse' : ''}`}
              onClick={() => {
                whoosh()
                start()
              }}
            >
              <Icon d="M7 4l12 8-12 8z" />
              启动产线
            </button>
          ) : (
            <button className="btn btn--primary" onClick={togglePause}>
              <Icon d={lineState === 'running' ? 'M8 5v14M16 5v14' : 'M7 4l12 8-12 8z'} />
              {lineState === 'running' ? '暂停' : '继续'}
            </button>
          )}
        </div>

        <div className="dock__divider" />

        <div className="dock__group">
          <span className="dock__label">速度</span>
          {([1, 2, 4] as Speed[]).map((s) => (
            <button key={s} className={`btn btn--chip${speed === s ? ' is-on' : ''}`} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>

        <div className="dock__divider" />

        <div className="dock__group">
          <span className="dock__label">机位</span>
          {VIEW_BUTTONS.map((v) => (
            <button
              key={v.key}
              className={`btn btn--chip${view === v.key ? ' is-on' : ''}`}
              onClick={() => setView(v.key)}
            >
              <Icon d={v.icon} />
              <span>{v.label}</span>
            </button>
          ))}
        </div>

        <div className="dock__divider" />

        <div className="dock__group">
          <button className="btn btn--chip" onClick={reset} title="清空产线并恢复初始状态">
            <Icon d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" />
            <span>重置</span>
          </button>
          <button
            className="btn btn--chip"
            onClick={() => {
              setMuted(!muted)
              click()
            }}
            title={muted ? '打开声音' : '静音'}
            aria-label={muted ? '打开声音' : '静音'}
          >
            <Icon d={muted ? 'M4 9v6h4l5 4V5L8 9H4zM17 9l4 6M21 9l-4 6' : 'M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 1 1 0 6'} />
          </button>
          <button
            className="btn btn--chip"
            onClick={() => {
              cycleQuality()
              click()
            }}
            title="画质：高 / 中 / 低"
          >
            画质 {quality === 'high' ? '高' : quality === 'medium' ? '中' : '低'}
          </button>
          <button
            className="btn btn--chip"
            onClick={() => {
              cycleDifficulty()
              click()
            }}
            title={`来料缺陷率 ${(DIFFICULTIES[difficulty].incomingDefect * 100).toFixed(0)}%`}
          >
            难度 {DIFFICULTIES[difficulty].label}
          </button>
          <button className="btn btn--ghost" onClick={() => setHelp(true)} aria-label="帮助">
            ?
          </button>
        </div>
      </div>

      {drag?.active && (
        <div
          className="drag-ghost"
          style={{ left: drag.x, top: drag.y, '--c': MATERIAL_BY_ID[drag.material].color } as CSSProperties}
        >
          {MATERIAL_SHORT[drag.material]}
        </div>
      )}

      {selected && !drag && (
        <div className="select-hint" onClick={() => selectMaterial(null)}>
          已选中「{MATERIAL_BY_ID[selected].name}」· 点击工站料仓投入 · 点击此处取消
        </div>
      )}

      {toast && (
        <div className={`toast toast--${toast.kind}`} key={toast.id}>
          {toast.text}
        </div>
      )}

      {help && (
        <div className="modal" onClick={() => setHelp(false)}>
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>怎么玩</h2>
              <button className="btn btn--ghost" onClick={() => setHelp(false)}>
                ✕
              </button>
            </div>
            <ol className="modal__steps">
              <li>
                <b>投料</b> 从右下角原料仓库把原料拖到对应工站上方的料仓；也可以先点原料再点料仓，
                或者按 <kbd>F</kbd> 一键按 BOM 配齐。每个料仓最多 12 件。
              </li>
              <li>
                <b>开线</b> 按「启动产线」。S1 会把铝锭冲成机壳放上传送带，后面 6 个站依次装配。
              </li>
              <li>
                <b>补料</b> 摄像头模组 3 件/台、其余 1 件/台，所以 S5 的料仓掉得最快。
                哪个站红灯就是缺料，补上就自动复产。
              </li>
              <li>
                <b>看瓶颈</b> S6 检测节拍 4s，是整条线的天花板；它前面堆料说明产能已经到顶。
              </li>
              <li>
                <b>难度</b> 底部「难度」按钮切换来料缺陷率：轻松 0%、标准 4%、硬核 9%。
                带缺陷的来料要到 S6 才暴露，等于白搭一整台的料。
              </li>
            </ol>
            <div className="modal__grid">
              {STATIONS.map((s) => (
                <div key={s.id} className="modal__station">
                  <span style={{ color: s.accent }}>{s.code}</span>
                  <b>{s.name}</b>
                  <em>
                    {s.inputs.map((i) => `${ITEM_NAMES[i.item]}×${i.qty}`).join(' + ')} → {ITEM_NAMES[s.output]}
                    <br />
                    {(s.yieldRate * 100).toFixed(1)}% · {s.cycleSec.toFixed(1)}s
                  </em>
                </div>
              ))}
            </div>
            <p className="modal__foot">
              <kbd>1</kbd>
              <kbd>2</kbd>
              <kbd>3</kbd>
              <kbd>4</kbd> 机位 · <kbd>空格</kbd> 启停 · <kbd>F</kbd> 配齐 · <kbd>Esc</kbd> 取消选中
            </p>
          </div>
        </div>
      )}
    </div>
  )
}