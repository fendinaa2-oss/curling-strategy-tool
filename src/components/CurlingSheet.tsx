import { useEffect, useRef, useState } from 'react'

type MatchFormat = 'four-person' | 'mixed-doubles'
type EndResult = 'self' | 'opponent' | 'blank'
type EndScore = {
  result: EndResult
  points: number
}

type SavedMatch = {
  id: string
  savedAt: string
  matchFormat: MatchFormat
  scoreSelf: number
  scoreOpponent: number
  endResults: EndScore[]
  throwHistory: ThrowRecord[]
  matchNote: string
}

type TeamColor = 'red' | 'yellow'
type ShotType =
  | 'Guard'
  | 'Draw'
  | 'Freeze'
  | 'Hit'
  | 'Hit & Roll'
  | 'Raise'
  | 'Peel'
  | 'Other'

type Stone = {
  id: number
  color: TeamColor
  x: number
  y: number
  out: boolean
}

type ThrowRecord = {
  endNumber: number
  throwNumber: number
  stones: Stone[]
  shotType: ShotType
  rating: number
  note: string
}

type UndoState = {
  stones: Stone[]
  currentEnd: number
  currentThrow: number
  scoreSelf: number
  scoreOpponent: number
  hammerTeam: 'self' | 'opponent'
  endResults: EndScore[]
  endPoints: number
  pendingStone: Stone | null
  nextStoneId: number
  throwHistory: ThrowRecord[]
}

const SHEET_WIDTH = 4.75
const TEE_TO_BACK = 1.829
const TEE_TO_HOG = 6.401
const PLAYING_LENGTH = TEE_TO_HOG + TEE_TO_BACK

const HOUSE_RADII = [1.829, 1.219, 0.61, 0.152]

const SCALE = 100
const STORAGE_KEY = 'curling-strategy-tool-state-v1'
const SAVED_MATCHES_KEY = 'curling-strategy-tool-matches-v1'
const SHOT_TYPES: ShotType[] = [
  'Guard',
  'Draw',
  'Freeze',
  'Hit',
  'Hit & Roll',
  'Raise',
  'Peel',
  'Other',
]

function CurlingSheet({
  matchFormat,
}: {
  matchFormat: MatchFormat
}) {
const [stones, setStones] = useState<Stone[]>([
 
])

const [currentThrow, setCurrentThrow] = useState(1)
const [currentEnd, setCurrentEnd] = useState(1)

const [throwHistory, setThrowHistory] =
  useState<ThrowRecord[]>([])

  const [selectedHistoryThrow, setSelectedHistoryThrow] =
  useState<number | null>(null)

const [selectedShotType, setSelectedShotType] =
  useState<ShotType>('Guard')
const [selectedRating, setSelectedRating] =
  useState<number>(3)
const [shotNote, setShotNote] = useState('')
const [scoreSelf, setScoreSelf] = useState(0)
const [scoreOpponent, setScoreOpponent] = useState(0)
const [hammerTeam, setHammerTeam] = useState<'self' | 'opponent'>('self')
const [endResult, setEndResult] = useState<EndResult | null>(null)
const [endResults, setEndResults] = useState<EndScore[]>([])
const [endPoints, setEndPoints] = useState(1)
const [showEndResultPage, setShowEndResultPage] = useState(false)
const [showMatchSettings, setShowMatchSettings] = useState(false)
const [matchFinished, setMatchFinished] = useState(false)
const [settingsStartEnd, setSettingsStartEnd] = useState(1)
const [settingsScoreSelf, setSettingsScoreSelf] = useState('0')
const [settingsScoreOpponent, setSettingsScoreOpponent] = useState('0')
const [matchNote, setMatchNote] = useState('')
const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([])

const [undoHistory, setUndoHistory] = useState<UndoState[]>([])

  const [selectedStoneId, setSelectedStoneId] =
  useState<number | null>(null)

const [isDraggingStone, setIsDraggingStone] = useState(false)
const [isDraggingPendingStone, setIsDraggingPendingStone] =
  useState(false)

const [pendingStone, setPendingStone] =
  useState<Stone | null>({
    id: 1,
    color: 'red',
    x: 0.35,
    y: 0.35,
    out: false,
  })

  const [nextStoneId, setNextStoneId] = useState(2)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const pendingStoneDragRef = useRef(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      return
    }

    try {
      const parsed = JSON.parse(saved) as {
        stones?: Stone[]
        currentEnd?: number
        currentThrow?: number
        pendingStone?: Stone | null
        throwHistory?: ThrowRecord[]
        nextStoneId?: number
        scoreSelf?: number
        scoreOpponent?: number
        hammerTeam?: 'self' | 'opponent'
        endResult?: EndResult | null
        endResults?: EndScore[]
        endPoints?: number
        matchNote?: string
      }

      if (parsed.stones) {
        setStones(parsed.stones)
      }

      if (typeof parsed.currentEnd === 'number') {
        setCurrentEnd(parsed.currentEnd)
      }

      if (typeof parsed.currentThrow === 'number') {
        setCurrentThrow(parsed.currentThrow)
      }

      if (parsed.pendingStone !== undefined) {
        setPendingStone(parsed.pendingStone)
      }

      if (parsed.throwHistory) {
        setThrowHistory(
          parsed.throwHistory.map((record) => ({
            ...record,
            endNumber: record.endNumber ?? 1,
          })),
        )
      }

      if (typeof parsed.nextStoneId === 'number') {
        setNextStoneId(parsed.nextStoneId)
      }

      if (typeof parsed.scoreSelf === 'number') {
        setScoreSelf(parsed.scoreSelf)
      }

      if (typeof parsed.scoreOpponent === 'number') {
        setScoreOpponent(parsed.scoreOpponent)
      }

      if (parsed.hammerTeam) {
        setHammerTeam(parsed.hammerTeam)
      }

      if (parsed.endResult !== undefined) {
        setEndResult(parsed.endResult)
      }

      if (parsed.endResults) {
        setEndResults(parsed.endResults)
      }

      if (typeof parsed.endPoints === 'number') {
        setEndPoints(parsed.endPoints)
      }

      if (typeof parsed.matchNote === 'string') {
        setMatchNote(parsed.matchNote)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_MATCHES_KEY)

    if (!saved) {
      return
    }

    try {
      setSavedMatches(JSON.parse(saved) as SavedMatch[])
    } catch {
      localStorage.removeItem(SAVED_MATCHES_KEY)
    }
  }, [])

  useEffect(() => {
    const payload = {
      stones,
      currentEnd,
      currentThrow,
      pendingStone,
      throwHistory,
      nextStoneId,
      scoreSelf,
      scoreOpponent,
      hammerTeam,
      endResult,
      endResults,
      endPoints,
      matchNote,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [stones, currentEnd, currentThrow, pendingStone, throwHistory, nextStoneId, scoreSelf, scoreOpponent, hammerTeam, endResult, endResults, endPoints, matchNote])

  const getPositionFromPointer = (
    event: React.PointerEvent,
  ) => {
    const svg = svgRef.current

    if (!svg) {
      return null
    }

    const rect = svg.getBoundingClientRect()

    const x =
      ((event.clientX - rect.left) / rect.width) *
      SHEET_WIDTH

    const y =
      ((event.clientY - rect.top) / rect.height) *
      PLAYING_LENGTH

    return {
      x: Math.max(
        0.145,
        Math.min(SHEET_WIDTH - 0.145, x),
      ),
      y: Math.max(
        0.145,
        Math.min(PLAYING_LENGTH - 0.145, y),
      ),
    }
  }

  const getRawPositionFromPointer = (
    event: React.PointerEvent,
  ) => {
    const svg = svgRef.current

    if (!svg) {
      return null
    }

    const rect = svg.getBoundingClientRect()

    return {
      x:
        ((event.clientX - rect.left) / rect.width) *
        SHEET_WIDTH,
      y:
        ((event.clientY - rect.top) / rect.height) *
        PLAYING_LENGTH,
    }
  }

 const saveUndoState = () => {
  const snapshot: UndoState = {
    stones: stones.map((stone) => ({ ...stone })),
    currentEnd,
    currentThrow,
    scoreSelf,
    scoreOpponent,
    hammerTeam,
    endResults: endResults.map((item) => ({ ...item })),
    endPoints,
    pendingStone: pendingStone
      ? { ...pendingStone }
      : null,
    nextStoneId,
    throwHistory: throwHistory.map((record) => ({
      ...record,
      stones: record.stones.map((stone) => ({ ...stone })),
    })),
  }

  setUndoHistory((current) => [
    ...current,
    snapshot,
  ])
}

const handleUndo = () => {
  if (undoHistory.length === 0) {
    return
  }

  const previousState =
    undoHistory[undoHistory.length - 1]

  setStones(previousState.stones)
  setCurrentEnd(previousState.currentEnd)
  setCurrentThrow(previousState.currentThrow)
  setScoreSelf(previousState.scoreSelf)
  setScoreOpponent(previousState.scoreOpponent)
  setHammerTeam(previousState.hammerTeam)
  setEndResults(previousState.endResults)
  setEndPoints(previousState.endPoints)
  setPendingStone(previousState.pendingStone)
  setNextStoneId(previousState.nextStoneId)
  setThrowHistory(previousState.throwHistory)

  setUndoHistory((current) =>
    current.slice(0, -1),
  )

  setSelectedStoneId(null)
}

const handleRecordThrow = () => {
  if (currentThrow > maxThrowsPerEnd) {
    alert('このエンドの投球は終了です。')
    return
  }

  if (!pendingStone || pendingStone.out) {
    alert('投球する石を盤面上で決めてください。')
    return
  }

  const placedStone: Stone = {
    ...pendingStone,
    id: nextStoneId,
    out: false,
  }

  const nextStones = [...stones, placedStone]

  const record: ThrowRecord = {
    endNumber: currentEnd,
    throwNumber: currentThrow,
    stones: nextStones.map((stone) => ({ ...stone })),
    shotType: selectedShotType,
    rating: selectedRating,
    note: shotNote,
  }

  saveUndoState()
  setStones(nextStones)
  setThrowHistory((current) => [...current, record])
  setSelectedHistoryThrow(currentThrow)

  setNextStoneId((current) => current + 1)

  setSelectedShotType('Guard')
  setSelectedRating(3)
  setShotNote('')

  if (currentThrow < maxThrowsPerEnd) {
    setPendingStone({
      id: nextStoneId + 1,
      color:
        pendingStone.color === 'red'
          ? 'yellow'
          : 'red',
      x: 0.3,
      y: 0.3,
      out: false,
    })

    setCurrentThrow((current) => current + 1)
  } else {
    setPendingStone(null)
  }
}

const handleNextEnd = () => {
  if (currentThrow < maxThrowsPerEnd) {
    return
  }

  setShowEndResultPage(true)
}

const handleConfirmEndResult = () => {

  if (!endResult) {
    alert('エンドの結果を選択してください。')
    return
  }

  const completedEndResult = endResult
  const completedEndPoints =
    completedEndResult === 'blank' ? 0 : endPoints

  saveUndoState()
  setEndResults((current) => [
    ...current,
    { result: completedEndResult, points: completedEndPoints },
  ])

  if (completedEndResult === 'self') {
    setScoreSelf((current) => current + completedEndPoints)
    setHammerTeam('opponent')
  } else if (completedEndResult === 'opponent') {
    setScoreOpponent((current) => current + completedEndPoints)
    setHammerTeam('self')
  }

  if (currentEnd >= maxEnds) {
    setShowEndResultPage(false)
    setEndResult(null)
    alert('規定エンドが終了しました。')
    return
  }

  setStones([])
  setCurrentEnd((current) => current + 1)
  setCurrentThrow(1)
  setSelectedHistoryThrow(null)
  setSelectedStoneId(null)
  setEndResult(null)
  setEndPoints(1)
  setShowEndResultPage(false)
  setPendingStone({
    id: nextStoneId,
    color: 'red',
    x: 0.35,
    y: 0.35,
    out: false,
  })
}

const createSavedMatch = (
  finalEndResult: EndResult,
): SavedMatch => {
  const finalPoints = finalEndResult === 'blank' ? 0 : endPoints

  return {
    id: `${Date.now()}`,
    savedAt: new Date().toISOString(),
    matchFormat,
    scoreSelf:
      scoreSelf +
      (finalEndResult === 'self' ? finalPoints : 0),
    scoreOpponent:
      scoreOpponent +
      (finalEndResult === 'opponent' ? finalPoints : 0),
    endResults: [
      ...endResults,
      { result: finalEndResult, points: finalPoints },
    ],
    throwHistory: throwHistory.map((record) => ({
      ...record,
      stones: record.stones.map((stone) => ({ ...stone })),
    })),
    matchNote,
  }
}

const persistSavedMatch = (match: SavedMatch) => {
  const nextMatches = [
    match,
    ...savedMatches.filter((item) => item.id !== match.id),
  ]

  setSavedMatches(nextMatches)
  localStorage.setItem(SAVED_MATCHES_KEY, JSON.stringify(nextMatches))
}

const handleLoadSavedMatch = (match: SavedMatch) => {
  const firstThrow = match.throwHistory.find(
    (record) => record.endNumber === 1 && record.throwNumber === 1,
  )

  setThrowHistory(match.throwHistory)
  setEndResults(match.endResults)
  setScoreSelf(match.scoreSelf)
  setScoreOpponent(match.scoreOpponent)
  setMatchNote(match.matchNote)
  setCurrentEnd(1)
  setCurrentThrow(1)
  setStones(firstThrow?.stones ?? [])
  setSelectedHistoryThrow(firstThrow ? 1 : null)
  setSelectedShotType(firstThrow?.shotType ?? 'Guard')
  setSelectedRating(firstThrow?.rating ?? 3)
  setShotNote(firstThrow?.note ?? '')
  setEndResult(null)
  setEndPoints(1)
  setShowEndResultPage(false)
  setMatchFinished(false)
  setShowMatchSettings(false)
}

const handleDownloadSavedMatch = (match: SavedMatch) => {
  const blob = new Blob([JSON.stringify(match, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `curling-match-${match.id}.json`
  link.click()
  URL.revokeObjectURL(url)
}

const handlePrintMatch = (match: SavedMatch) => {
  const printWindow = window.open('', '_blank')

  if (!printWindow) {
    alert('印刷画面を開けませんでした。ポップアップを許可してください。')
    return
  }

  const escapeHtml = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')

  const sheetWidth = 190
  const sheetHeight = 330
  const centerX = sheetWidth / 2
  const houseY = 82
  const houseRadii = [72, 48, 24, 6]

  const renderPrintSheet = (record: ThrowRecord) => {
    const stones = record.stones
      .filter((stone) => !stone.out)
      .map(
        (stone) => `<circle cx="${(stone.x / SHEET_WIDTH) * sheetWidth}"
          cy="${(stone.y / PLAYING_LENGTH) * sheetHeight}"
          r="5.8" fill="${stone.color === 'red' ? '#df4b4b' : '#f2d94e'}"
          stroke="${stone.color === 'red' ? '#b93636' : '#c5a800'}" stroke-width="1" />`,
      )
      .join('')

    return `<svg class="mini-sheet" viewBox="0 0 ${sheetWidth} ${sheetHeight}" role="img" aria-label="${record.endNumber}エンド ${record.throwNumber}投目">
      <rect width="${sheetWidth}" height="${sheetHeight}" fill="#f5fbfd" />
      <rect width="${sheetWidth}" height="${(TEE_TO_HOG / PLAYING_LENGTH) * sheetHeight}" fill="#edf7fa" />
      <circle cx="${centerX}" cy="${houseY}" r="${houseRadii[0]}" fill="#e8f3f7" stroke="#c8d5da" stroke-width="0.8" />
      <circle cx="${centerX}" cy="${houseY}" r="${houseRadii[1]}" fill="#fff" stroke="#c8d5da" stroke-width="0.8" />
      <circle cx="${centerX}" cy="${houseY}" r="${houseRadii[2]}" fill="#e8f3f7" stroke="#c8d5da" stroke-width="0.8" />
      <circle cx="${centerX}" cy="${houseY}" r="${houseRadii[3]}" fill="#fff" stroke="#c8d5da" stroke-width="0.8" />
      <line x1="${centerX}" y1="0" x2="${centerX}" y2="${sheetHeight}" stroke="#c8d5da" stroke-width="0.8" />
      <line x1="0" y1="${houseY}" x2="${sheetWidth}" y2="${houseY}" stroke="#c8d5da" stroke-width="0.8" />
      <line x1="0" y1="${(TEE_TO_HOG / PLAYING_LENGTH) * sheetHeight}" x2="${sheetWidth}" y2="${(TEE_TO_HOG / PLAYING_LENGTH) * sheetHeight}" stroke="#aebdc3" stroke-width="1" />
      ${stones}
    </svg>`
  }

  const throwCards = match.throwHistory
    .map(
      (record) => `<article class="throw-card">
        ${renderPrintSheet(record)}
        <div class="throw-meta"><strong>${record.endNumber}エンド ${record.throwNumber}投目</strong> / ${escapeHtml(record.shotType)} / 評価 ${record.rating}/5</div>
        <div class="throw-note">${escapeHtml(record.note || 'コメントなし')}</div>
      </article>`,
    )
    .join('')

  printWindow.document.write(`<!doctype html><html><head><title>Curling match report</title><style>
    @page { size: A4; margin: 10mm; }
    body { font-family: sans-serif; font-size: 9px; color: #111; }
    h1 { font-size: 16px; margin: 0 0 6px; }
    p { margin: 3px 0; }
    .throw-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin-top: 8px; }
    .throw-card { border: 0; padding: 0; break-inside: avoid; page-break-inside: avoid; min-width: 0; overflow: hidden; }
    .mini-sheet { display: block; width: 100%; height: auto; aspect-ratio: 190 / 330; border: 1px solid #bbb; }
    .throw-meta { font-size: 6.5px; line-height: 1.15; margin-top: 2px; overflow-wrap: anywhere; }
    .throw-note { font-size: 6.5px; line-height: 1.15; min-height: 14px; margin-top: 1px; overflow-wrap: anywhere; }
  </style></head><body>
    <h1>カーリング試合レポート</h1>
    <p>形式: ${match.matchFormat === 'four-person' ? '4人制' : 'Mixed Doubles'}</p>
    <p>保存日時: ${new Date(match.savedAt).toLocaleString()}</p>
    <p>最終スコア: 自チーム ${match.scoreSelf} - ${match.scoreOpponent} 相手</p>
    <p>試合メモ: ${escapeHtml(match.matchNote || '-')}</p>
    <div class="throw-grid">${throwCards}</div>
  </body></html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

const handleFinishMatch = () => {
  if (!endResult) {
    return
  }

  persistSavedMatch(createSavedMatch(endResult))
  handleConfirmEndResult()
  setMatchFinished(true)
}

const handleApplyMatchSettings = () => {
  const targetEnd = Math.max(
    1,
    Math.min(maxEnds, settingsStartEnd),
  )
  const keptEndResults = endResults.slice(0, targetEnd - 1)
  const keptHistory = throwHistory.filter(
    (record) => record.endNumber < targetEnd,
  )
  const recalculatedSelf = keptEndResults.reduce(
    (total, end) =>
      total + (end.result === 'self' ? end.points : 0),
    0,
  )
  const recalculatedOpponent = keptEndResults.reduce(
    (total, end) =>
      total + (end.result === 'opponent' ? end.points : 0),
    0,
  )

  saveUndoState()
  setStones([])
  setCurrentEnd(targetEnd)
  setCurrentThrow(1)
  setThrowHistory(keptHistory)
  setEndResults(keptEndResults)
  setScoreSelf(
    Number.isNaN(Number(settingsScoreSelf))
      ? recalculatedSelf
      : Number(settingsScoreSelf),
  )
  setScoreOpponent(
    Number.isNaN(Number(settingsScoreOpponent))
      ? recalculatedOpponent
      : Number(settingsScoreOpponent),
  )
  setEndResult(null)
  setEndPoints(1)
  setShowEndResultPage(false)
  setMatchFinished(false)
  setSelectedHistoryThrow(null)
  setSelectedStoneId(null)
  setPendingStone({
    id: nextStoneId,
    color: 'red',
    x: 0.35,
    y: 0.35,
    out: false,
  })
  setShowMatchSettings(false)
}

const handleHistorySelect = (endNumber: number, throwNumber: number) => {
  const record = throwHistory.find(
    (item) =>
      item.endNumber === endNumber &&
      item.throwNumber === throwNumber,
  )

  if (!record) {
    return
  }

  setSelectedHistoryThrow(throwNumber)
  setCurrentEnd(endNumber)
  setStones(record.stones.map((stone) => ({ ...stone })))
  setCurrentThrow(record.throwNumber)
  setSelectedShotType(record.shotType)
  setSelectedRating(record.rating)
  setShotNote(record.note)
  setSelectedStoneId(null)
}

const clearCurrentMatch = () => {
  const confirmed = window.confirm(
    '現在の試合データをリセットしますか？保存済みの状態も消去されます。',
  )

  if (!confirmed) {
    return
  }

  setStones([])
  setCurrentEnd(1)
  setCurrentThrow(1)
  setThrowHistory([])
  setSelectedHistoryThrow(null)
  setSelectedShotType('Guard')
  setSelectedRating(3)
  setShotNote('')
  setScoreSelf(0)
  setScoreOpponent(0)
  setHammerTeam('self')
  setEndResult(null)
  setEndResults([])
  setEndPoints(1)
  setShowEndResultPage(false)
  setShowMatchSettings(false)
  setMatchFinished(false)
  setSettingsStartEnd(1)
  setSettingsScoreSelf('0')
  setSettingsScoreOpponent('0')
  setMatchNote('')
  setUndoHistory([])
  setSelectedStoneId(null)
  setIsDraggingStone(false)
  setIsDraggingPendingStone(false)
  setPendingStone({
    id: 1,
    color: 'red',
    x: 0.35,
    y: 0.35,
    out: false,
  })
  setNextStoneId(2)
  localStorage.removeItem(STORAGE_KEY)
}

const handlePendingStonePointerDown = (
  event: React.PointerEvent<HTMLDivElement>,
) => {
  pendingStoneDragRef.current = true
  setIsDraggingPendingStone(true)
  event.currentTarget.setPointerCapture(event.pointerId)
}

const handlePendingStonePointerMove = (
  event: React.PointerEvent<HTMLDivElement>,
) => {
  if (
    !event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    return
  }

  const rawPosition = getRawPositionFromPointer(event)

  if (!rawPosition) {
    return
  }

  const position = {
    x: Math.max(
      0.145,
      Math.min(SHEET_WIDTH - 0.145, rawPosition.x),
    ),
    y: Math.max(
      0.145,
      Math.min(PLAYING_LENGTH - 0.145, rawPosition.y),
    ),
  }
  const isOut =
    rawPosition.x < 0 ||
    rawPosition.x > SHEET_WIDTH ||
    rawPosition.y < 0 ||
    rawPosition.y > PLAYING_LENGTH

  setPendingStone((current) =>
    current
      ? {
          ...current,
          x: position.x,
          y: position.y,
          out: isOut,
        }
      : null,
  )
}

const handlePendingStonePointerUp = (
  event: React.PointerEvent<HTMLDivElement>,
) => {
  event.currentTarget.releasePointerCapture(event.pointerId)
  pendingStoneDragRef.current = false
  setIsDraggingPendingStone(false)
}

const handlePendingStoneSvgPointerDown = (
  event: React.PointerEvent<SVGCircleElement>,
) => {
  pendingStoneDragRef.current = true
  setIsDraggingPendingStone(true)
  event.currentTarget.setPointerCapture(event.pointerId)
}

const handlePendingStoneSvgPointerMove = (
  event: React.PointerEvent<SVGCircleElement>,
) => {
  if (
    !event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    return
  }

  const rawPosition = getRawPositionFromPointer(event)

  if (!rawPosition) {
    return
  }

  const position = {
    x: Math.max(
      0.145,
      Math.min(SHEET_WIDTH - 0.145, rawPosition.x),
    ),
    y: Math.max(
      0.145,
      Math.min(PLAYING_LENGTH - 0.145, rawPosition.y),
    ),
  }
  const isOut =
    rawPosition.x < 0 ||
    rawPosition.x > SHEET_WIDTH ||
    rawPosition.y < 0 ||
    rawPosition.y > PLAYING_LENGTH

  setPendingStone((current) =>
    current
      ? {
          ...current,
          x: position.x,
          y: position.y,
          out: isOut,
        }
      : null,
  )
}

const handlePendingStoneSvgPointerUp = (
  event: React.PointerEvent<SVGCircleElement>,
) => {
  event.currentTarget.releasePointerCapture(event.pointerId)
  pendingStoneDragRef.current = false
  setIsDraggingPendingStone(false)
}


  const handlePointerDown = (
  event: React.PointerEvent<SVGCircleElement>,
  stoneId: number,
) => {
  event.currentTarget.setPointerCapture(event.pointerId)
  setSelectedStoneId(stoneId)
}

  const handlePointerMove = (
    event: React.PointerEvent<SVGCircleElement>,
    stoneId: number,
  ) => {
    if (
      !event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      return
    }

    if (!isDraggingStone) {
  saveUndoState()
  setIsDraggingStone(true)
}

    const position = getPositionFromPointer(event)

    if (!position) {
      return
    }
 
    setStones((current) =>
  current.map((stone) => {
    if (stone.id !== stoneId) {
      return stone
    }

    const svg = svgRef.current

    if (!svg) {
      return stone
    }

    const rect = svg.getBoundingClientRect()

    const rawX =
      ((event.clientX - rect.left) / rect.width) *
      SHEET_WIDTH

    const rawY =
      ((event.clientY - rect.top) / rect.height) *
      PLAYING_LENGTH

    const isOut =
      rawX < 0 ||
      rawX > SHEET_WIDTH ||
      rawY < 0 ||
      rawY > PLAYING_LENGTH

    return {
      ...stone,
      x: Math.max(
        0.145,
        Math.min(SHEET_WIDTH - 0.145, rawX),
      ),
      y: Math.max(
        0.145,
        Math.min(PLAYING_LENGTH - 0.145, rawY),
      ),
      out: isOut,
    }
  }),
)
  }

  const handlePointerUp = (
  event: React.PointerEvent<SVGCircleElement>,
) => {
  event.currentTarget.releasePointerCapture(event.pointerId)
  setIsDraggingStone(false)
}

  const handleDeleteStone = () => {
    if (selectedStoneId === null) {
      return
    }

    saveUndoState()

    setStones((current) =>
      current.filter(
        (stone) => stone.id !== selectedStoneId,
      ),
    )

    setSelectedStoneId(null)
  }

  const centerX = SHEET_WIDTH / 2
  const houseCenterY = TEE_TO_BACK
  const maxEnds = matchFormat === 'four-person' ? 10 : 8
  const maxThrowsPerEnd =
    matchFormat === 'four-person' ? 16 : 10

  const totalRating = throwHistory.reduce(
    (sum, record) => sum + record.rating,
    0,
  )
  const successRate =
    throwHistory.length === 0
      ? 0
      : (totalRating / (throwHistory.length * 5)) * 100
  const matchWinner =
    scoreSelf === scoreOpponent
      ? '同点'
      : scoreSelf > scoreOpponent
        ? '自チーム リード'
        : '相手チーム リード'

  if (matchFinished) {
    return (
      <div className="curling-sheet">
        <h2>試合終了</h2>
        <p>
          最終スコア：自チーム {scoreSelf} - {scoreOpponent} 相手
        </p>
        <strong>{matchWinner}</strong>
        <button
          onClick={() => {
            setMatchFinished(false)
            setShowMatchSettings(true)
            setSettingsStartEnd(currentEnd)
            setSettingsScoreSelf(String(scoreSelf))
            setSettingsScoreOpponent(String(scoreOpponent))
          }}
          style={{
            display: 'block',
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#fff',
          }}
        >
          設定を開く
        </button>
        {savedMatches.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <strong>保存済み試合</strong>
            {savedMatches.map((match) => (
              <div
                key={match.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  alignItems: 'center',
                  marginTop: '8px',
                }}
              >
                <span style={{ marginRight: '4px', fontSize: '13px' }}>
                  {new Date(match.savedAt).toLocaleString()} / {match.scoreSelf}-{match.scoreOpponent}
                </span>
                <button onClick={() => handleLoadSavedMatch(match)}>
                  1投目から見る
                </button>
                <button onClick={() => handlePrintMatch(match)}>
                  この試合だけ印刷 / PDF
                </button>
                <button onClick={() => handleDownloadSavedMatch(match)}>
                  JSON保存
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (showEndResultPage) {
    return (
      <div className="curling-sheet">
        <div
          style={{
            marginBottom: '16px',
            fontSize: '22px',
            fontWeight: '700',
          }}
        >
          {currentEnd}エンドの結果
        </div>

        <div
          style={{
            marginBottom: '16px',
            padding: '14px',
            borderRadius: '10px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          現在のスコア：自チーム {scoreSelf} - {scoreOpponent} 相手
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '14px',
          }}
        >
          {([
            ['self', '自チーム'],
            ['opponent', '相手'],
            ['blank', 'ブランク'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setEndResult(value)
                if (value === 'blank') {
                  setEndPoints(0)
                } else if (endPoints === 0) {
                  setEndPoints(1)
                }
              }}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border:
                  endResult === value
                    ? '2px solid #2878d7'
                    : '1px solid #cbd5e1',
                background:
                  endResult === value ? '#eaf3ff' : '#fff',
              }}
            >
              {value === 'blank' ? label : `${label}が得点`}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '14px' }}>得点：</span>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((points) => (
            <button
              key={points}
              onClick={() => {
                setEndPoints(points)
                if (points === 0) {
                  setEndResult('blank')
                } else if (endResult === 'blank') {
                  setEndResult('self')
                }
              }}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border:
                  endPoints === points
                    ? '2px solid #2878d7'
                    : '1px solid #cbd5e1',
                background:
                  endPoints === points ? '#eaf3ff' : '#fff',
                fontWeight: '700',
              }}
            >
              {points}
            </button>
          ))}
        </div>

        {endResult && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              borderRadius: '8px',
              background: '#eaf3ff',
              border: '1px solid #93c5fd',
              fontWeight: '600',
            }}
          >
            確定内容：
            {endResult === 'self'
              ? `自チーム ${endPoints}点`
              : endResult === 'opponent'
                ? `相手 ${endPoints}点`
                : 'ブランク 0点'}
          </div>
        )}

        <button
          onClick={handleConfirmEndResult}
          disabled={!endResult}
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #2878d7',
            background: endResult ? '#2878d7' : '#eef2f7',
            color: endResult ? '#fff' : '#999',
            cursor: endResult ? 'pointer' : 'default',
            fontWeight: '700',
          }}
        >
          次のエンドを開始
        </button>
        <button
          onClick={handleFinishMatch}
          disabled={!endResult}
          style={{
            display: 'block',
            marginTop: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #dc2626',
            background: endResult ? '#fff1f2' : '#f8fafc',
            color: endResult ? '#b91c1c' : '#999',
            cursor: endResult ? 'pointer' : 'default',
          }}
        >
          試合を終了する
        </button>
      </div>
    )
  }

  return (
    <div className="curling-sheet">
  {!showEndResultPage && <>
  <div
    style={{
      marginBottom: '12px',
      fontSize: '20px',
      fontWeight: 'bold',
    }}
  >
    {currentEnd}エンド　{currentThrow}投目 / 全{maxEnds}エンド
  </div>

  <button
    onClick={() => {
      setSettingsStartEnd(currentEnd)
      setSettingsScoreSelf(String(scoreSelf))
      setSettingsScoreOpponent(String(scoreOpponent))
      setShowMatchSettings((current) => !current)
    }}
    style={{
      marginBottom: '12px',
      padding: '8px 12px',
      borderRadius: '8px',
      border: '1px solid #cbd5e1',
      background: '#fff',
    }}
  >
    設定
  </button>

  {showMatchSettings && (
    <div
      style={{
        marginBottom: '16px',
        padding: '12px',
        borderRadius: '10px',
        border: '1px solid #cbd5e1',
        background: '#f8fafc',
      }}
    >
      <strong>試合設定</strong>
      <label style={{ display: 'block', marginTop: '10px' }}>
        開始するエンド
        <select
          value={settingsStartEnd}
          onChange={(event) =>
            setSettingsStartEnd(Number(event.target.value))
          }
          style={{ display: 'block', marginTop: '4px', padding: '6px' }}
        >
          {Array.from({ length: maxEnds }, (_, index) => index + 1).map(
            (end) => (
              <option key={end} value={end}>
                {end}エンド
              </option>
            ),
          )}
        </select>
      </label>
      <label style={{ display: 'block', marginTop: '10px' }}>
        自チーム得点
        <input
          type="number"
          min="0"
          value={settingsScoreSelf}
          onChange={(event) => setSettingsScoreSelf(event.target.value)}
          style={{ display: 'block', width: '100%', padding: '6px' }}
        />
      </label>
      <label style={{ display: 'block', marginTop: '10px' }}>
        相手チーム得点
        <input
          type="number"
          min="0"
          value={settingsScoreOpponent}
          onChange={(event) => setSettingsScoreOpponent(event.target.value)}
          style={{ display: 'block', width: '100%', padding: '6px' }}
        />
      </label>
      <button
        onClick={handleApplyMatchSettings}
        style={{
          marginTop: '12px',
          padding: '9px 12px',
          borderRadius: '8px',
          border: '1px solid #2878d7',
          background: '#eaf3ff',
        }}
      >
        設定を反映して再開
      </button>
      {savedMatches.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <strong>保存済み試合</strong>
          {savedMatches.map((match) => (
            <div
              key={match.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                alignItems: 'center',
                marginTop: '8px',
              }}
            >
              <span style={{ fontSize: '13px' }}>
                {new Date(match.savedAt).toLocaleString()} / {match.scoreSelf}-{match.scoreOpponent}
              </span>
              <button onClick={() => handleLoadSavedMatch(match)}>
                1投目から見る
              </button>
              <button onClick={() => handlePrintMatch(match)}>
                この試合だけ印刷 / PDF
              </button>
              <button onClick={() => handleDownloadSavedMatch(match)}>
                JSON保存
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )}

  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '16px',
      padding: '10px 12px',
      borderRadius: '8px',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
    }}
  >
    <span style={{ fontWeight: '600' }}>試合状況</span>
    <strong>{matchWinner}</strong>
  </div>

  <div
    style={{
      marginBottom: '16px',
      overflowX: 'auto',
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      background: '#fff',
    }}
  >
    <div
      style={{
        padding: '10px 12px',
        fontWeight: '600',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      エンド別スコア
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ padding: '8px', textAlign: 'left' }}>エンド</th>
          <th style={{ padding: '8px', textAlign: 'left' }}>結果</th>
        </tr>
      </thead>
      <tbody>
        {endResults.length === 0 ? (
          <tr>
            <td colSpan={2} style={{ padding: '8px', color: '#777' }}>
              エンド結果はまだありません。
            </td>
          </tr>
        ) : (
          endResults.map((end, index) => (
            <tr key={`${index + 1}-${end.result}-${end.points}`}>
              <td style={{ padding: '8px' }}>{index + 1}エンド</td>
              <td style={{ padding: '8px' }}>
                {end.result === 'self'
                  ? `自チーム ${end.points}点`
                  : end.result === 'opponent'
                    ? `相手 ${end.points}点`
                    : 'ブランク'}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>

  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '12px',
      marginBottom: '16px',
    }}
  >
    <div
      style={{
        border: '1px solid #dbeafe',
        borderRadius: '10px',
        background: '#eff6ff',
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          color: '#4b5563',
          marginBottom: '4px',
        }}
      >
        自チーム
      </div>
      <div
        style={{
          fontSize: '28px',
          fontWeight: '700',
        }}
      >
        {scoreSelf}
      </div>
    </div>

    <div
      style={{
        border: '1px solid #fef3c7',
        borderRadius: '10px',
        background: '#fffbeb',
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          color: '#4b5563',
          marginBottom: '4px',
        }}
      >
        相手チーム
      </div>
      <div
        style={{
          fontSize: '28px',
          fontWeight: '700',
        }}
      >
        {scoreOpponent}
      </div>
    </div>
  </div>

  <div
    style={{
      display: 'none',
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      padding: '12px',
      marginBottom: '16px',
      background: '#f9fafb',
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '8px',
      }}
    >
      <div style={{ fontWeight: '600' }}>試合情報</div>
      <div style={{ fontSize: '13px', color: '#666' }}>
        成功率: {successRate.toFixed(1)}%
      </div>
    </div>

    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '10px',
      }}
    >
      <button
        onClick={() => setHammerTeam('self')}
        style={{
          padding: '6px 10px',
          borderRadius: '8px',
          border:
            hammerTeam === 'self'
              ? '2px solid #2878d7'
              : '1px solid #cbd5e1',
          background:
            hammerTeam === 'self' ? '#eaf3ff' : '#fff',
          cursor: 'pointer',
        }}
      >
        自チーム ハンマー
      </button>
      <button
        onClick={() => setHammerTeam('opponent')}
        style={{
          padding: '6px 10px',
          borderRadius: '8px',
          border:
            hammerTeam === 'opponent'
              ? '2px solid #2878d7'
              : '1px solid #cbd5e1',
          background:
            hammerTeam === 'opponent' ? '#eaf3ff' : '#fff',
          cursor: 'pointer',
        }}
      >
        相手ハンマー
      </button>
    </div>

    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px',
      }}
    >
      <span style={{ fontSize: '13px', color: '#4b5563' }}>
        このエンドの結果
      </span>
      {([
        ['self', '自チーム'],
        ['opponent', '相手'],
        ['blank', 'ブランク'],
      ] as const).map(([value, label]) => (
        <button
          key={value}
          onClick={() => {
            setEndResult(value)
            if (value === 'blank') {
              setEndPoints(0)
            } else if (endPoints === 0) {
              setEndPoints(1)
            }
          }}
          disabled={currentThrow < maxThrowsPerEnd}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            border:
              endResult === value
                ? '2px solid #2878d7'
                : '1px solid #cbd5e1',
            background:
              endResult === value ? '#eaf3ff' : '#fff',
            color:
              currentThrow < maxThrowsPerEnd ? '#999' : '#222',
            cursor:
              currentThrow < maxThrowsPerEnd ? 'default' : 'pointer',
          }}
        >
          {value === 'blank' ? label : `${label} ${endPoints}点`}
        </button>
      ))}
    </div>

    {currentThrow >= maxThrowsPerEnd && endResult && (
      <div
        style={{
          marginBottom: '10px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: '#eaf3ff',
          border: '1px solid #93c5fd',
          color: '#1e3a8a',
          fontWeight: '600',
        }}
      >
        このエンドの結果：
        {endResult === 'self'
          ? `自チーム ${endPoints}点`
          : endResult === 'opponent'
            ? `相手 ${endPoints}点`
            : 'ブランク 0点'}
        <span
          style={{
            display: 'block',
            marginTop: '4px',
            fontSize: '13px',
            fontWeight: '400',
          }}
        >
          内容を確認してから「次のエンドへ」を押してください。
        </span>
      </div>
    )}

    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '10px',
      }}
    >
      <span style={{ fontSize: '13px', color: '#4b5563' }}>
        得点
      </span>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((points) => (
        <button
          key={points}
          onClick={() => {
            setEndPoints(points)
            if (points === 0) {
              setEndResult('blank')
            } else if (endResult === 'blank') {
              setEndResult('self')
            }
          }}
          disabled={currentThrow < maxThrowsPerEnd}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border:
              endPoints === points
                ? '2px solid #2878d7'
                : '1px solid #cbd5e1',
            background:
              endPoints === points ? '#eaf3ff' : '#fff',
            color:
              currentThrow < maxThrowsPerEnd ? '#999' : '#222',
            cursor:
              currentThrow < maxThrowsPerEnd ? 'default' : 'pointer',
            fontWeight: '700',
          }}
        >
          {points}
        </button>
      ))}
    </div>

    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '10px',
      }}
    >
      <button
        onClick={clearCurrentMatch}
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #ef4444',
          background: '#fff',
          color: '#dc2626',
          cursor: 'pointer',
        }}
      >
        新規試合開始
      </button>
      <button
        onClick={() => localStorage.removeItem(STORAGE_KEY)}
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          background: '#fff',
          cursor: 'pointer',
        }}
      >
        保存を消去
      </button>
    </div>

    <label
      style={{
        display: 'block',
        marginBottom: '6px',
        fontSize: '14px',
      }}
    >
      試合メモ
    </label>
    <textarea
      value={matchNote}
      onChange={(event) => setMatchNote(event.target.value)}
      placeholder="例：右側のリミットを狙う。相手のハウスを詰める。"
      style={{
        width: '100%',
        minHeight: '60px',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        padding: '8px 10px',
        resize: 'vertical',
        boxSizing: 'border-box',
      }}
    />
  </div>
  </>}

      <div
  style={{
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  }}
>
        <button
          onClick={handleDeleteStone}
          disabled={selectedStoneId === null}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            background:
              selectedStoneId === null
                ? '#eee'
                : '#fff',
            color:
              selectedStoneId === null
                ? '#999'
                : '#222',
            cursor:
              selectedStoneId === null
                ? 'default'
                : 'pointer',
          }}
        >
          石を削除
        </button>
        <button
  onClick={handleUndo}
  disabled={undoHistory.length === 0}
  style={{
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    background:
  undoHistory.length === 0
    ? '#eee'
    : '#fff',
 color:
  undoHistory.length === 0
    ? '#999'
    : '#222',
    cursor:
  undoHistory.length === 0
    ? 'default'
    : 'pointer',
  }}
>
  ↩ Undo
</button>

<button
  onClick={handleRecordThrow}
  style={{
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    background: '#fff',
    cursor: 'pointer',
  }}
>
  投球を記録
</button>
<button
  onClick={handleNextEnd}
  disabled={currentThrow < maxThrowsPerEnd}
  style={{
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #2878d7',
    background:
      currentThrow < maxThrowsPerEnd ? '#eef2f7' : '#eaf3ff',
    color:
      currentThrow < maxThrowsPerEnd ? '#999' : '#1d5fa7',
    cursor:
      currentThrow < maxThrowsPerEnd ? 'default' : 'pointer',
  }}
>
  次のエンドへ
</button>
      </div>

      <p
        style={{
          margin: '0 0 10px',
          fontSize: '14px',
          color: '#666',
        }}
      >
        石をタップすると選択できます。選択中の石は青い枠で表示されます。
      </p>


        {pendingStone && !isDraggingPendingStone && (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '10px',
    }}
  >
    <span
      style={{
        fontSize: '14px',
        color: '#666',
      }}
    >
      次の石：
    </span>

    <div
      style={{
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        background:
          pendingStone.color === 'red'
            ? '#df4b4b'
            : '#f2d94e',
        border:
          pendingStone.color === 'red'
            ? '1px solid #b93636'
            : '1px solid #c5a800',
        cursor: 'grab',
        touchAction: 'none',
      }}
      onPointerDown={handlePendingStonePointerDown}
      onPointerMove={handlePendingStonePointerMove}
      onPointerUp={handlePendingStonePointerUp}
    />

    <span
      style={{
        fontSize: '14px',
        color: '#666',
      }}
    >
      この石を盤面へドラッグ
    </span>
  </div>
)}
      <svg
        className="sheet-board"
        ref={svgRef}
        viewBox={`0 0 ${SHEET_WIDTH * SCALE} ${
          PLAYING_LENGTH * SCALE
        }`}
        width="100%"
        style={{
          display: 'block',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {/* Sheet */}
        <rect
          x="0"
          y="0"
          width={SHEET_WIDTH * SCALE}
          height={PLAYING_LENGTH * SCALE}
          fill="#f5fbfd"
        />

        {/* Free Guard Zone */}
        <rect
          x="0"
          y="0"
          width={SHEET_WIDTH * SCALE}
          height={(TEE_TO_HOG - 1.219) * SCALE}
          fill="#edf7fa"
        />

        {/* House */}
        <circle
          cx={centerX * SCALE}
          cy={houseCenterY * SCALE}
          r={HOUSE_RADII[0] * SCALE}
          fill="#e8f3f7"
          stroke="#c8d5da"
          strokeWidth="0.7"
        />

        <circle
          cx={centerX * SCALE}
          cy={houseCenterY * SCALE}
          r={HOUSE_RADII[1] * SCALE}
          fill="#ffffff"
          stroke="#c8d5da"
          strokeWidth="0.7"
        />

        <circle
          cx={centerX * SCALE}
          cy={houseCenterY * SCALE}
          r={HOUSE_RADII[2] * SCALE}
          fill="#e8f3f7"
          stroke="#c8d5da"
          strokeWidth="0.7"
        />

        <circle
          cx={centerX * SCALE}
          cy={houseCenterY * SCALE}
          r={HOUSE_RADII[3] * SCALE}
          fill="#ffffff"
          stroke="#c8d5da"
          strokeWidth="0.7"
        />

        {/* Center line */}
        <line
          x1={centerX * SCALE}
          y1="0"
          x2={centerX * SCALE}
          y2={PLAYING_LENGTH * SCALE}
          stroke="#c8d5da"
          strokeWidth="0.7"
        />

        {/* Tee line */}
        <line
          x1="0"
          y1={houseCenterY * SCALE}
          x2={SHEET_WIDTH * SCALE}
          y2={houseCenterY * SCALE}
          stroke="#c8d5da"
          strokeWidth="0.7"
        />

        {/* Back line */}
        <line
          x1="0"
          y1="0"
          x2={SHEET_WIDTH * SCALE}
          y2="0"
          stroke="#c8d5da"
          strokeWidth="0.7"
        />

        {/* Hog line */}
        <line
          x1="0"
          y1={(TEE_TO_HOG - 1.219) * SCALE}
          x2={SHEET_WIDTH * SCALE}
          y2={(TEE_TO_HOG - 1.219) * SCALE}
          stroke="#aebdc3"
          strokeWidth="1.2"
        />

        {/* Stones */}
        {stones.map((stone) => {
            if (stone.out) {
                return null
            }

          return (
            <g key={stone.id}>
              

              <circle
                cx={stone.x * SCALE}
                cy={stone.y * SCALE}
                r={0.145 * SCALE}
                fill={
                  stone.color === 'red'
                    ? '#df4b4b'
                    : '#f2d94e'
                }
                stroke={
                  selectedStoneId === stone.id
                    ? '#2878d7'
                    : stone.color === 'red'
                    ? '#b93636'
                    : '#c5a800'
                }
                strokeWidth={selectedStoneId === stone.id ? '1.2' : '0.6'}
                style={{
                  cursor: 'grab',
                  touchAction: 'none',
                }}
                onPointerDown={(event) =>
                  handlePointerDown(
                    event,
                    stone.id,
                  )
                }
                onPointerMove={(event) =>
                  handlePointerMove(
                    event,
                    stone.id,
                  )
                }
                onPointerUp={handlePointerUp}
              />
            </g>
          )
        })}

        {/* Pending stone preview */}
        {pendingStone && !pendingStone.out && (
          <circle
            cx={pendingStone.x * SCALE}
            cy={pendingStone.y * SCALE}
            r={0.145 * SCALE}
            fill={
              pendingStone.color === 'red'
                ? '#df4b4b'
                : '#f2d94e'
            }
            stroke="#2878d7"
            strokeWidth="1.2"
            opacity="0.8"
            style={{ cursor: 'grab', touchAction: 'none' }}
            onPointerDown={handlePendingStoneSvgPointerDown}
            onPointerMove={handlePendingStoneSvgPointerMove}
            onPointerUp={handlePendingStoneSvgPointerUp}
          />
        )}
      </svg>
        <div
      className="throw-log"
  style={{
    marginTop: '16px',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '10px',
    background: '#fff',
  }}
>
  <div
    style={{
      fontWeight: 'bold',
      marginBottom: '8px',
    }}
  >
    投球記録
  </div>

  <div
    style={{
      marginBottom: '16px',
      padding: '12px',
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      background: '#f9fafb',
    }}
  >
    <div
      style={{
        fontSize: '14px',
        fontWeight: '600',
        marginBottom: '8px',
      }}
    >
      現在の記録
    </div>

    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '12px',
      }}
    >
      {SHOT_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => setSelectedShotType(type)}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            border:
              selectedShotType === type
                ? '2px solid #2878d7'
                : '1px solid #cbd5e1',
            background:
              selectedShotType === type ? '#eaf3ff' : '#fff',
            cursor: 'pointer',
          }}
        >
          {type}
        </button>
      ))}
    </div>

    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '12px',
      }}
    >
      {[0, 1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          onClick={() => setSelectedRating(value)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border:
              selectedRating === value
                ? '2px solid #2878d7'
                : '1px solid #cbd5e1',
            background:
              selectedRating === value ? '#eaf3ff' : '#fff',
            cursor: 'pointer',
            fontWeight: '700',
          }}
        >
          {value}
        </button>
      ))}
    </div>

    <label
      style={{
        display: 'block',
        fontSize: '14px',
        marginBottom: '6px',
      }}
    >
      メモ
    </label>
    <textarea
      value={shotNote}
      onChange={(event) => setShotNote(event.target.value)}
      placeholder="例：ハウスの左側に押し出し、アドバンテージを取りたい"
      style={{
        width: '100%',
        minHeight: '60px',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        padding: '8px 10px',
        resize: 'vertical',
        boxSizing: 'border-box',
      }}
    />
  </div>

  {throwHistory.length === 0 ? (
    <div
      style={{
        fontSize: '14px',
        color: '#777',
      }}
    >
      まだ記録された投球はありません。
    </div>
  ) : (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {throwHistory.map((record) => (
        <button
          key={`${record.endNumber}-${record.throwNumber}`}
          onClick={() =>
            handleHistorySelect(record.endNumber, record.throwNumber)
          }
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border:
              selectedHistoryThrow === record.throwNumber
                ? '2px solid #2878d7'
                : '1px solid #ccc',
            background:
              selectedHistoryThrow === record.throwNumber
                ? '#eef6ff'
                : '#fff',
            cursor: 'pointer',
          }}
        >
          {record.endNumber}エンド {record.throwNumber}投目
        </button>
      ))}
    </div>
  )}

  {selectedHistoryThrow !== null && (
    <div
      style={{
        marginTop: '12px',
        padding: '10px 12px',
        borderRadius: '8px',
        background: '#eef6ff',
        border: '1px solid #cfe3ff',
        fontSize: '14px',
      }}
    >
      選択中の投球：{selectedHistoryThrow}投目 / ショット：
      {
        throwHistory.find(
          (record) => record.throwNumber === selectedHistoryThrow,
        )?.shotType ?? '未記録'
      }
      / 評価：
      {
        throwHistory.find(
          (record) => record.throwNumber === selectedHistoryThrow,
        )?.rating ?? 0
      }
    </div>
  )}
</div>
    </div>
  )
}

export default CurlingSheet