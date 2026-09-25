import { useEffect, useRef, useState } from 'react'

type MatchFormat = 'four-person' | 'mixed-doubles'
type EndResult = 'self' | 'opponent' | 'blank'
type EndScore = {
  result: EndResult
  points: number
  powerPlay?: boolean
}

export type SavedMatch = {
  id: string
  savedAt: string
  matchFormat: MatchFormat
  endCount?: number
  teamColor?: TeamColor
  initialHammerTeam?: 'self' | 'opponent'
  teamName?: string
  opponentName?: string
  playerNames?: string[]
  mixedDoublesGuardPosition?: MixedDoublesGuardPosition
  scoreSelf: number
  scoreOpponent: number
  endResults: EndScore[]
  powerPlayUsedTeams?: Record<PowerPlayTeam, boolean>
  throwHistory: ThrowRecord[]
  matchNote: string
  currentEnd?: number
  currentThrow?: number
  stones?: Stone[]
  pendingStone?: Stone | null
  nextStoneId?: number
  hammerTeam?: 'self' | 'opponent'
  matchFinished?: boolean
}

type TeamColor = 'red' | 'yellow'
type MixedDoublesGuardPosition =
  | 'A1-house'
  | 'A1-hog'
  | 'A2-house'
  | 'A2-hog'
  | 'A3-house'
  | 'A3-hog'
  | 'A4-house'
  | 'A4-hog'
type PowerPlaySide = 'left' | 'right'
type PowerPlayTeam = 'self' | 'opponent'
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
  throwerTeam?: 'self' | 'opponent'
}

type UndoState = {
  stones: Stone[]
  currentEnd: number
  currentThrow: number
  scoreSelf: number
  scoreOpponent: number
  hammerTeam: 'self' | 'opponent'
  endResults: EndScore[]
  powerPlayEnds: number[]
  powerPlayUsedTeams: Record<PowerPlayTeam, boolean>
  endPoints: number
  pendingStone: Stone | null
  nextStoneId: number
  throwHistory: ThrowRecord[]
}

const SHEET_WIDTH = 4.75
const TEE_TO_BACK = 1.829
const TEE_TO_HOG = 6.401
const HOG_LINE_Y = TEE_TO_BACK + TEE_TO_HOG
const BOARD_EDGE_MARGIN = 0.6
const BOARD_TOP_Y = -BOARD_EDGE_MARGIN
const BOARD_BOTTOM_Y = HOG_LINE_Y + BOARD_EDGE_MARGIN
const BOARD_VIEW_HEIGHT = BOARD_BOTTOM_Y - BOARD_TOP_Y
const WAITING_STONE_X = 0.35
const WAITING_STONE_Y = -0.3

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

const MIXED_DOUBLES_GUARD_DISTANCES: Record<
  MixedDoublesGuardPosition,
  number
> = {
  'A1-house': 1.372 - 0.457,
  'A1-hog': 1.372 + 0.457,
  'A2-house': 1.981 - 0.457,
  'A2-hog': 1.981 + 0.457,
  'A3-house': 2.591 - 0.457,
  'A3-hog': 2.591 + 0.457,
  'A4-house': 3.2 - 0.457,
  'A4-hog': 3.2 + 0.457,
}

const getOpponentColor = (teamColor: TeamColor): TeamColor =>
  teamColor === 'red' ? 'yellow' : 'red'

const getFirstThrowColor = (
  teamColor: TeamColor,
  hammerTeam: 'self' | 'opponent',
): TeamColor =>
  hammerTeam === 'self' ? getOpponentColor(teamColor) : teamColor

const createMixedDoublesPositionedStones = (
  guardPosition: MixedDoublesGuardPosition,
  teamColor: TeamColor,
  hammerTeam: 'self' | 'opponent',
  startingId = 1,
  powerPlaySide?: PowerPlaySide,
): Stone[] => {
  const houseStoneColor =
    hammerTeam === 'self' ? teamColor : getOpponentColor(teamColor)
  const guardStoneColor = getOpponentColor(houseStoneColor)
  const houseStoneY = powerPlaySide
    ? TEE_TO_BACK - 0.145
    : TEE_TO_BACK - 0.61 + 0.145
  const guardStoneY =
    TEE_TO_BACK + HOUSE_RADII[0] + MIXED_DOUBLES_GUARD_DISTANCES[guardPosition]
  const positionedX = powerPlaySide
    ? SHEET_WIDTH / 2 +
      (powerPlaySide === 'left' ? -HOUSE_RADII[1] : HOUSE_RADII[1])
    : SHEET_WIDTH / 2

  return [
    {
      id: startingId,
      color: guardStoneColor,
      x: positionedX,
      y: guardStoneY,
      out: false,
    },
    {
      id: startingId + 1,
      color: houseStoneColor,
      x: positionedX,
      y: houseStoneY,
      out: false,
    },
  ]
}

function CurlingSheet({
  matchFormat,
  endCount,
  onEndCountChange,
  teamColor,
  teamName,
  opponentName,
  playerNames,
  initialHammerTeam,
  mixedDoublesGuardPosition,
  onResetToSetup,
  savedMatchToLoad,
  onLoadComplete,
}: {
  matchFormat: MatchFormat
  endCount: number
  onEndCountChange: (endCount: number) => void
  teamColor: TeamColor
  teamName: string
  opponentName: string
  playerNames: string[]
  initialHammerTeam: 'self' | 'opponent'
  mixedDoublesGuardPosition?: MixedDoublesGuardPosition
  onResetToSetup?: () => void
  savedMatchToLoad?: SavedMatch | null
  onLoadComplete?: () => void
}) {
const initialPositionedStones =
  matchFormat === 'mixed-doubles' && mixedDoublesGuardPosition
    ? createMixedDoublesPositionedStones(
        mixedDoublesGuardPosition,
        teamColor,
        initialHammerTeam,
      )
    : []

const [stones, setStones] = useState<Stone[]>(initialPositionedStones)

const [currentThrow, setCurrentThrow] = useState(1)
const [currentEnd, setCurrentEnd] = useState(1)

const [throwHistory, setThrowHistory] =
  useState<ThrowRecord[]>([])

  const [selectedHistoryThrow, setSelectedHistoryThrow] =
  useState<number | null>(null)
  const [editingThrowKey, setEditingThrowKey] = useState<string | null>(null)
const [showShotPreview, setShowShotPreview] = useState(false)
const [selectedPreviewEnd, setSelectedPreviewEnd] = useState<number | null>(null)

const [selectedShotType, setSelectedShotType] =
  useState<ShotType>('Guard')
const [selectedRating, setSelectedRating] =
  useState<number>(3)
const [shotNote, setShotNote] = useState('')
const [scoreSelf, setScoreSelf] = useState(0)
const [scoreOpponent, setScoreOpponent] = useState(0)
const [hammerTeam, setHammerTeam] = useState<'self' | 'opponent'>(initialHammerTeam)
const [endResult, setEndResult] = useState<EndResult | null>(null)
const [endResults, setEndResults] = useState<EndScore[]>([])
const [powerPlayEnds, setPowerPlayEnds] = useState<number[]>([])
const [powerPlayUsedTeams, setPowerPlayUsedTeams] = useState<
  Record<PowerPlayTeam, boolean>
>({ self: false, opponent: false })
const [endPoints, setEndPoints] = useState(1)
const [showEndResultPage, setShowEndResultPage] = useState(false)
const [showPowerPlaySetup, setShowPowerPlaySetup] = useState(false)
const [powerPlaySide, setPowerPlaySide] = useState<PowerPlaySide>('left')
const [powerPlayTeam, setPowerPlayTeam] = useState<PowerPlayTeam>('self')
const [powerPlaySideForNextEnd, setPowerPlaySideForNextEnd] =
  useState<PowerPlaySide | null>(null)
const powerPlayUsed =
  powerPlayUsedTeams.self && powerPlayUsedTeams.opponent
const [showMatchSettings, setShowMatchSettings] = useState(false)
const [showShotRate, setShowShotRate] = useState(false)
const [selectedShotRateMatchId, setSelectedShotRateMatchId] =
  useState<string | null>(null)
const [matchFinished, setMatchFinished] = useState(false)
const [settingsStartEnd, setSettingsStartEnd] = useState(1)
const [settingsStartThrow, setSettingsStartThrow] = useState(1)
const [showScoreboardEdit, setShowScoreboardEdit] = useState(false)
const [scoreboardEditEnd, setScoreboardEditEnd] = useState(1)
const [scoreboardEditTeam, setScoreboardEditTeam] = useState<'self' | 'opponent'>('self')
const [scoreboardEditPoints, setScoreboardEditPoints] = useState(0)
const [settingsScoreSelf, setSettingsScoreSelf] = useState('0')
const [settingsScoreOpponent, setSettingsScoreOpponent] = useState('0')
const [matchNote, setMatchNote] = useState('')
const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([])
const [scrollPosition, setScrollPosition] = useState(0)

const [undoHistory, setUndoHistory] = useState<UndoState[]>([])

  const [selectedStoneId, setSelectedStoneId] =
  useState<number | null>(null)


const [pendingStone, setPendingStone] =
  useState<Stone | null>({
    id: initialPositionedStones.length + 1,
    color: getFirstThrowColor(teamColor, initialHammerTeam),
    x: WAITING_STONE_X,
    y: WAITING_STONE_Y,
    out: false,
  })

  const [nextStoneId, setNextStoneId] = useState(
    initialPositionedStones.length + 1,
  )

  const svgRef = useRef<SVGSVGElement | null>(null)
  const pendingStoneDragRef = useRef(false)

  useEffect(() => {
    const updateScrollPosition = () => {
      const scrollableHeight =
        document.documentElement.scrollHeight - window.innerHeight
      setScrollPosition(
        scrollableHeight > 0
          ? Math.round((window.scrollY / scrollableHeight) * 1000) / 10
          : 0,
      )
    }

    updateScrollPosition()
    window.addEventListener('scroll', updateScrollPosition, { passive: true })
    window.addEventListener('resize', updateScrollPosition)

    return () => {
      window.removeEventListener('scroll', updateScrollPosition)
      window.removeEventListener('resize', updateScrollPosition)
    }
  }, [])

  const handleScrollRailChange = (value: string) => {
    const scrollableHeight =
      document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({
      top: (Number(value) / 100) * Math.max(0, scrollableHeight),
      behavior: 'auto',
    })
  }

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
        powerPlayEnds?: number[]
        powerPlayUsedTeams?: Record<PowerPlayTeam, boolean>
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

      if (parsed.powerPlayEnds) {
        setPowerPlayEnds(parsed.powerPlayEnds)
      }

      if (parsed.powerPlayUsedTeams) {
        setPowerPlayUsedTeams(parsed.powerPlayUsedTeams)
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
      powerPlayEnds,
      powerPlayUsedTeams,
      endPoints,
      matchNote,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [stones, currentEnd, currentThrow, pendingStone, throwHistory, nextStoneId, scoreSelf, scoreOpponent, hammerTeam, endResult, endResults, powerPlayEnds, powerPlayUsedTeams, endPoints, matchNote])

  const getPositionFromPointer = (
    event: React.PointerEvent,
  ) => {
    const svg = svgRef.current

    if (!svg) {
      return null
    }

    const screenCtm = svg.getScreenCTM()

    if (!screenCtm) {
      return null
    }

    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const svgPoint = point.matrixTransform(screenCtm.inverse())
    const x = svgPoint.x / SCALE
    const y = svgPoint.y / SCALE

    return {
      x: Math.max(
        0.145,
        Math.min(SHEET_WIDTH - 0.145, x),
      ),
      y: Math.max(
        BOARD_TOP_Y,
        Math.min(BOARD_BOTTOM_Y - 0.145, y),
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

    const screenCtm = svg.getScreenCTM()

    if (!screenCtm) {
      return null
    }

    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const svgPoint = point.matrixTransform(screenCtm.inverse())

    return {
      x: svgPoint.x / SCALE,
      y: svgPoint.y / SCALE,
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
    powerPlayEnds: [...powerPlayEnds],
    powerPlayUsedTeams: { ...powerPlayUsedTeams },
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

  setStones(
    previousState.stones.map((stone) => ({
      ...stone,
    })),
  )
  setCurrentEnd(previousState.currentEnd)
  setCurrentThrow(previousState.currentThrow)
  setScoreSelf(previousState.scoreSelf)
  setScoreOpponent(previousState.scoreOpponent)
  setHammerTeam(previousState.hammerTeam)
  setEndResults(
    previousState.endResults.map((item) => ({
      ...item,
    })),
  )
  setPowerPlayEnds([...previousState.powerPlayEnds])
  setPowerPlayUsedTeams({ ...previousState.powerPlayUsedTeams })
  setEndPoints(previousState.endPoints)
  setPendingStone(
    previousState.pendingStone
      ? { ...previousState.pendingStone }
      : null,
  )
  setNextStoneId(previousState.nextStoneId)
  setThrowHistory(
    previousState.throwHistory.map((record) => ({
      ...record,
      stones: record.stones.map((stone) => ({ ...stone })),
    })),
  )

  setUndoHistory((current) =>
    current.slice(0, -1),
  )

  setSelectedStoneId(null)
}

const handleRecordThrow = () => {
  if (currentThrow > maxThrowsPerEnd) {
    handleNextEnd()
    return
  }

  const canPlacePendingStone = Boolean(
    pendingStone && !pendingStone.out,
  )
  const placedStone = canPlacePendingStone && pendingStone
    ? {
        ...pendingStone,
        id: nextStoneId,
        out: false,
      }
    : null

  const nextStones = placedStone
    ? [...stones, placedStone]
    : [...stones]
  const nextThrowNumber = currentThrow + 1
  const nextStoneNumber =
    nextStoneId + (placedStone ? 1 : 0)

  const record: ThrowRecord = {
    endNumber: currentEnd,
    throwNumber: currentThrow,
    stones: nextStones.map((stone) => ({ ...stone })),
    shotType: selectedShotType,
    rating: selectedRating,
    note: shotNote,
    throwerTeam:
      (currentThrow % 2 === 1) === (hammerTeam === 'opponent')
        ? 'self'
        : 'opponent',
  }

  saveUndoState()
  setStones(nextStones)
  setThrowHistory((current) => {
    if (!editingThrowKey) {
      return [...current, record]
    }

    const editingIndex = current.findIndex(
      (item) => `${item.endNumber}-${item.throwNumber}` === editingThrowKey,
    )

    if (editingIndex === -1) {
      return [...current, record]
    }

    return [...current.slice(0, editingIndex), record]
  })
  setEditingThrowKey(null)
  setSelectedPreviewEnd(currentEnd)
  setSelectedHistoryThrow(currentThrow)
  setShowShotPreview(true)

  if (placedStone) {
    setNextStoneId((current) => current + 1)
  }

  setSelectedShotType('Guard')
  setSelectedRating(3)
  setShotNote('')

  if (currentThrow < maxThrowsPerEnd) {
    setPendingStone({
      id: nextStoneNumber,
      color:
        pendingStone?.color === 'red'
          ? 'yellow'
          : 'red',
      x: WAITING_STONE_X,
      y: WAITING_STONE_Y,
      out: false,
    })

    setCurrentThrow(nextThrowNumber)
  } else {
    setPendingStone(null)
    setCurrentThrow(maxThrowsPerEnd + 1)
  }
}

const handleNextEnd = () => {
  if (currentThrow < maxThrowsPerEnd) {
    return
  }

  setShowEndResultPage(true)
}

const handleOpenPowerPlaySetup = () => {
  const hasCurrentEndThrow = throwHistory.some(
    (record) => record.endNumber === currentEnd,
  )

  const canApplyBeforeFirstThrow =
    currentThrow === 1 && !hasCurrentEndThrow
  const canApplyAfterEndResult =
    showEndResultPage && currentThrow >= maxThrowsPerEnd

  if (
    matchFormat !== 'mixed-doubles' ||
    (!canApplyBeforeFirstThrow && !canApplyAfterEndResult) ||
    currentEnd >= maxEnds ||
    powerPlayUsedTeams[powerPlayTeam]
  ) {
    return
  }

  setPowerPlaySideForNextEnd(null)
  setShowPowerPlaySetup(true)
}

const handleApplyPowerPlay = () => {
  if (
    !powerPlaySide ||
    currentEnd >= maxEnds ||
    powerPlayUsedTeams[powerPlayTeam]
  ) {
    return
  }

  saveUndoState()

  const hasCurrentEndThrow = throwHistory.some(
    (record) => record.endNumber === currentEnd,
  )

  if (currentThrow === 1 && !hasCurrentEndThrow) {
    const firstPositionedStoneId = stones[0]?.id ?? 1
    const currentPositionedStones = createMixedDoublesPositionedStones(
      mixedDoublesGuardPosition!,
      teamColor,
      hammerTeam,
      firstPositionedStoneId,
      powerPlaySide,
    )

    setStones(currentPositionedStones)
    setPowerPlayEnds((current) =>
      current.includes(currentEnd) ? current : [...current, currentEnd],
    )
    setPowerPlayUsedTeams((current) => ({
      ...current,
      [powerPlayTeam]: true,
    }))
    setShowPowerPlaySetup(false)
    return
  }

  setPowerPlaySideForNextEnd(powerPlaySide)
  setPowerPlayUsedTeams((current) => ({
    ...current,
    [powerPlayTeam]: true,
  }))
  setShowPowerPlaySetup(false)
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
    {
      result: completedEndResult,
      points: completedEndPoints,
      powerPlay: powerPlayEnds.includes(currentEnd),
    },
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

  const nextHammerTeam =
    completedEndResult === 'self'
      ? 'opponent'
      : completedEndResult === 'opponent'
        ? 'self'
        : hammerTeam
  const positionedStoneStartingId = nextStoneId
  const nextPowerPlaySide = powerPlaySideForNextEnd
  const nextPositionedStones =
    matchFormat === 'mixed-doubles' && mixedDoublesGuardPosition
      ? createMixedDoublesPositionedStones(
          mixedDoublesGuardPosition,
          teamColor,
          nextHammerTeam,
          positionedStoneStartingId,
          nextPowerPlaySide ?? undefined,
        )
      : []

  setStones(nextPositionedStones)
  setCurrentEnd((current) => current + 1)
  setCurrentThrow(1)
  setSelectedHistoryThrow(null)
  setSelectedStoneId(null)
  setEndResult(null)
  setEndPoints(1)
  if (nextPowerPlaySide) {
    setPowerPlayEnds((current) => [...current, currentEnd + 1])
  }
  setPowerPlaySideForNextEnd(null)
  setShowEndResultPage(false)
  setNextStoneId(positionedStoneStartingId + nextPositionedStones.length)
  setPendingStone({
    id: positionedStoneStartingId + nextPositionedStones.length,
    color: getFirstThrowColor(teamColor, nextHammerTeam),
    x: WAITING_STONE_X,
    y: WAITING_STONE_Y,
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
    endCount,
    teamColor,
    initialHammerTeam,
    scoreSelf:
      scoreSelf +
      (finalEndResult === 'self' ? finalPoints : 0),
    scoreOpponent:
      scoreOpponent +
      (finalEndResult === 'opponent' ? finalPoints : 0),
    endResults: [
      ...endResults,
      {
        result: finalEndResult,
        points: finalPoints,
        powerPlay: powerPlayEnds.includes(currentEnd),
      },
    ],
    powerPlayUsedTeams,
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

const handleDeleteSavedMatch = (matchId: string) => {
  const nextMatches = savedMatches.filter((match) => match.id !== matchId)
  setSavedMatches(nextMatches)
  localStorage.setItem(SAVED_MATCHES_KEY, JSON.stringify(nextMatches))
}

useEffect(() => {
    if (!savedMatchToLoad) {
      return
    }

    handleLoadSavedMatch(savedMatchToLoad)
    onLoadComplete?.()
  }, [savedMatchToLoad])

  const handleLoadSavedMatch = (match: SavedMatch) => {
  const firstThrow = match.throwHistory.find(
    (record) => record.endNumber === 1 && record.throwNumber === 1,
  )
  const loadedEnd = match.currentEnd ?? 1
  const loadedThrow = match.currentThrow ?? 1
  const loadedStones = match.stones ?? firstThrow?.stones ?? []
  const loadedPendingStone = match.pendingStone ?? null

  setThrowHistory(match.throwHistory)
  onEndCountChange(
    match.endCount ?? (match.matchFormat === 'four-person' ? 10 : 8),
  )
  setEndResults(match.endResults)
  const loadedPowerPlayEnds = match.endResults.reduce<number[]>(
    (ends, result, index) =>
      result.powerPlay ? [...ends, index + 1] : ends,
    [],
  )
  setPowerPlayEnds(loadedPowerPlayEnds)
  setPowerPlayUsedTeams(
    match.powerPlayUsedTeams ??
      (loadedPowerPlayEnds.length > 0
        ? { self: true, opponent: false }
        : { self: false, opponent: false }),
  )
  setScoreSelf(match.scoreSelf)
  setScoreOpponent(match.scoreOpponent)
  setMatchNote(match.matchNote)
  setCurrentEnd(loadedEnd)
  setCurrentThrow(loadedThrow)
  setStones(loadedStones)
  setPendingStone(loadedPendingStone)
  setNextStoneId(match.nextStoneId ?? Math.max(loadedStones.length + 1, firstThrow?.stones.length ?? 0 + 1))
  setHammerTeam(match.hammerTeam ?? initialHammerTeam)
  setSelectedHistoryThrow(firstThrow ? 1 : null)
  setSelectedShotType(firstThrow?.shotType ?? 'Guard')
  setSelectedRating(firstThrow?.rating ?? 3)
  setShotNote(firstThrow?.note ?? '')
  setEndResult(null)
  setEndPoints(1)
  setShowEndResultPage(false)
  setMatchFinished(match.matchFinished ?? false)
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
  const sheetHeight = (sheetWidth * BOARD_VIEW_HEIGHT) / SHEET_WIDTH
  const centerX = sheetWidth / 2
  const scaleX = sheetWidth / SHEET_WIDTH
  const toPrintX = (x: number) => x * scaleX
  const toPrintY = (y: number) => (y - BOARD_TOP_Y) * scaleX
  const houseY = toPrintY(houseCenterY)
  const houseRadii = HOUSE_RADII.map((radius) => radius * scaleX)

  const renderPrintSheet = (record: ThrowRecord) => {
    const stones = record.stones
      .filter((stone) => !stone.out)
      .map(
        (stone) => `<circle cx="${toPrintX(stone.x)}"
          cy="${toPrintY(stone.y)}"
          r="${0.145 * scaleX}" fill="${stone.color === 'red' ? '#df4b4b' : '#f2d94e'}"
          stroke="${stone.color === 'red' ? '#b93636' : '#c5a800'}" stroke-width="1" />`,
      )
      .join('')

    return `<svg class="mini-sheet" viewBox="0 ${BOARD_TOP_Y * scaleX} ${sheetWidth} ${sheetHeight}" role="img" aria-label="${record.endNumber}エンド ${record.throwNumber}投目">
      <rect x="0" y="${BOARD_TOP_Y * scaleX}" width="${sheetWidth}" height="${sheetHeight}" fill="#fff" />
      <circle cx="${centerX}" cy="${houseY}" r="${houseRadii[0]}" fill="#e8f3f7" stroke="#c8d5da" stroke-width="0.8" />
      <circle cx="${centerX}" cy="${houseY}" r="${houseRadii[1]}" fill="#fff" stroke="#c8d5da" stroke-width="0.8" />
      <circle cx="${centerX}" cy="${houseY}" r="${houseRadii[2]}" fill="#e8f3f7" stroke="#c8d5da" stroke-width="0.8" />
      <circle cx="${centerX}" cy="${houseY}" r="${houseRadii[3]}" fill="#fff" stroke="#c8d5da" stroke-width="0.8" />
      <line x1="${centerX}" y1="${BOARD_TOP_Y * scaleX}" x2="${centerX}" y2="${BOARD_BOTTOM_Y * scaleX}" stroke="#c8d5da" stroke-width="0.8" />
      <line x1="0" y1="${houseY}" x2="${sheetWidth}" y2="${houseY}" stroke="#c8d5da" stroke-width="0.8" />
      <line x1="0" y1="${toPrintY(0)}" x2="${sheetWidth}" y2="${toPrintY(0)}" stroke="#c8d5da" stroke-width="0.8" />
      <line x1="0" y1="${toPrintY(HOG_LINE_Y)}" x2="${sheetWidth}" y2="${toPrintY(HOG_LINE_Y)}" stroke="#aebdc3" stroke-width="1" />
      ${stones}
    </svg>`
  }

  const renderThrowCard = (record: ThrowRecord) => `<article class="throw-card">
        ${renderPrintSheet(record)}
        <div class="throw-meta"><strong>${record.endNumber}エンド ${record.throwNumber}投目</strong> / ${escapeHtml(record.shotType)} / 評価 ${record.rating}/4</div>
        <div class="throw-note">${escapeHtml(record.note || 'コメントなし')}</div>
      </article>`

  const throwPages = Array.from(
    { length: Math.ceil(match.throwHistory.length / 16) },
    (_, pageIndex) => match.throwHistory.slice(pageIndex * 16, pageIndex * 16 + 16),
  )
    .map(
      (records) => `<section class="throw-page">${records
        .map(renderThrowCard)
        .join('')}</section>`,
    )
    .join('')

  printWindow.document.write(`<!doctype html><html><head><title>Curling match report</title><style>
    @page { size: A4 landscape; margin: 7mm; }
    body { font-family: sans-serif; font-size: 9px; color: #111; }
    h1 { font-size: 13px; margin: 0 0 3px; }
    p { margin: 1px 0; font-size: 7px; }
    .throw-page { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 2mm 2mm; height: 165mm; page-break-after: always; break-after: page; }
    .throw-page:last-child { page-break-after: auto; break-after: auto; }
    .throw-card { border: 0; padding: 0; break-inside: avoid; page-break-inside: avoid; min-width: 0; overflow: hidden; }
    .mini-sheet { display: block; width: 100%; height: auto; aspect-ratio: ${sheetWidth} / ${sheetHeight}; border: 1px solid #bbb; }
    .throw-meta { font-size: 5.5px; line-height: 1.1; margin-top: 1px; overflow-wrap: anywhere; }
    .throw-note { font-size: 5.5px; line-height: 1.1; min-height: 8px; margin-top: 1px; overflow-wrap: anywhere; }
  </style></head><body>
    <h1>カーリング試合レポート</h1>
    <p>形式: ${match.matchFormat === 'four-person' ? '4人制' : 'Mixed Doubles'}</p>
    <p>保存日時: ${new Date(match.savedAt).toLocaleString()}</p>
    <p>最終スコア: 自チーム ${match.scoreSelf} - ${match.scoreOpponent} 相手</p>
    <p>試合メモ: ${escapeHtml(match.matchNote || '-')}</p>
    ${throwPages}
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

const handleSaveCurrentMatch = () => {
  const snapshot: SavedMatch = {
    id: `${Date.now()}`,
    savedAt: new Date().toISOString(),
    matchFormat,
    endCount,
    teamColor,
    initialHammerTeam,
    teamName,
    opponentName,
    playerNames,
    mixedDoublesGuardPosition,
    scoreSelf,
    scoreOpponent,
    endResults,
    powerPlayUsedTeams,
    throwHistory: throwHistory.map((record) => ({
      ...record,
      stones: record.stones.map((stone) => ({ ...stone })),
    })),
    matchNote,
    currentEnd,
    currentThrow,
    stones: stones.map((stone) => ({ ...stone })),
    pendingStone: pendingStone ? { ...pendingStone } : null,
    nextStoneId,
    hammerTeam,
    matchFinished,
  }

  persistSavedMatch(snapshot)
  alert('試合を途中保存しました。')
}

const handleApplyMatchSettings = () => {
  const targetEnd = Math.max(1, Math.min(maxEnds, settingsStartEnd))
  const targetThrow = Math.max(1, Math.min(maxThrowsPerEnd, settingsStartThrow))
  const keptEndResults = endResults.slice(0, targetEnd - 1)
  const keptPowerPlayEnds = powerPlayEnds.filter((end) => end < targetEnd)
  const keptHistory = throwHistory.filter(
    (record) =>
      record.endNumber < targetEnd ||
      (record.endNumber === targetEnd && record.throwNumber < targetThrow),
  )
  const recalculatedSelf = keptEndResults.reduce(
    (total, end) => total + (end.result === 'self' ? end.points : 0),
    0,
  )
  const recalculatedOpponent = keptEndResults.reduce(
    (total, end) => total + (end.result === 'opponent' ? end.points : 0),
    0,
  )

  saveUndoState()
  setStones([])
  setCurrentEnd(targetEnd)
  setCurrentThrow(targetThrow)
  setThrowHistory(keptHistory)
  setEndResults(keptEndResults)
  setPowerPlayEnds(keptPowerPlayEnds)
  setPowerPlayUsedTeams({
    self: false,
    opponent: false,
  })
  setPowerPlaySideForNextEnd(null)
  setShowPowerPlaySetup(false)
  setScoreSelf(recalculatedSelf)
  setScoreOpponent(recalculatedOpponent)
  setEndResult(null)
  setEndPoints(1)
  setShowEndResultPage(false)
  setMatchFinished(false)
  setSelectedHistoryThrow(null)
  setSelectedStoneId(null)
  setPendingStone({
    id: 1,
    color: 'red',
    x: WAITING_STONE_X,
    y: WAITING_STONE_Y,
    out: false,
  })
  setShowMatchSettings(false)
}

const handleApplyScoreboardCorrection = () => {
  const selectedEnd = Math.max(1, Math.min(maxEnds, scoreboardEditEnd))
  const selectedPoints = Math.max(0, Math.min(8, Number(scoreboardEditPoints) || 0))
  const nextResults = [...endResults]

  while (nextResults.length < selectedEnd) {
    nextResults.push({ result: 'blank', points: 0, powerPlay: false })
  }

  const targetIndex = selectedEnd - 1
  nextResults[targetIndex] = {
    result: scoreboardEditTeam,
    points: selectedPoints,
    powerPlay: powerPlayEnds.includes(selectedEnd),
  }

  saveUndoState()
  setEndResults(nextResults)
  setScoreSelf(
    nextResults.reduce(
      (total, end) => total + (end.result === 'self' ? end.points : 0),
      0,
    ),
  )
  setScoreOpponent(
    nextResults.reduce(
      (total, end) => total + (end.result === 'opponent' ? end.points : 0),
      0,
    ),
  )
  setSettingsScoreSelf(String(
    nextResults.reduce(
      (total, end) => total + (end.result === 'self' ? end.points : 0),
      0,
    ),
  ))
  setSettingsScoreOpponent(String(
    nextResults.reduce(
      (total, end) => total + (end.result === 'opponent' ? end.points : 0),
      0,
    ),
  ))
  setShowScoreboardEdit(false)
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

  setSelectedPreviewEnd(endNumber)
  setSelectedHistoryThrow(throwNumber)
}

const handleEditSelectedPreview = () => {
  const recordIndex = throwHistory.findIndex(
    (item) =>
      item.endNumber === selectedPreviewEnd &&
      item.throwNumber === selectedHistoryThrow,
  )

  if (recordIndex === -1) {
    return
  }

  const record = throwHistory[recordIndex]
  const previousStones =
    recordIndex > 0 &&
    throwHistory[recordIndex - 1].endNumber === record.endNumber
      ? throwHistory[recordIndex - 1].stones
      : []
  const previousStoneIds = new Set(previousStones.map((stone) => stone.id))
  const addedStone = record.stones.find(
    (stone) => !previousStoneIds.has(stone.id),
  )
  const keptHistory = throwHistory.slice(0, recordIndex)

  setCurrentEnd(record.endNumber)
  setCurrentThrow(record.throwNumber)
  setStones(previousStones.map((stone) => ({ ...stone })))
  setPendingStone(
    addedStone
      ? { ...addedStone, id: nextStoneId, out: false }
      : null,
  )
  setThrowHistory(keptHistory)
  setNextStoneId((current) =>
    Math.max(
      current,
      ...keptHistory.flatMap((item) =>
        item.stones.map((stone) => stone.id + 1),
      ),
    ),
  )
  setEditingThrowKey(`${record.endNumber}-${record.throwNumber}`)
  setSelectedShotType(record.shotType)
  setSelectedRating(record.rating)
  setShotNote(record.note)
  setSelectedStoneId(null)
  setSelectedHistoryThrow(null)
  setSelectedPreviewEnd(null)
  setShowShotPreview(false)
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
  setPowerPlayEnds([])
  setPowerPlayUsedTeams({ self: false, opponent: false })
  setPowerPlaySideForNextEnd(null)
  setShowPowerPlaySetup(false)
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
  setPendingStone({
    id: 1,
    color: 'red',
    x: WAITING_STONE_X,
    y: WAITING_STONE_Y,
    out: false,
  })
  setNextStoneId(2)
  localStorage.removeItem(STORAGE_KEY)
}

const handlePendingStoneSvgPointerDown = (
  event: React.PointerEvent<SVGCircleElement>,
) => {
  saveUndoState()
  pendingStoneDragRef.current = true
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
      BOARD_TOP_Y,
      Math.min(BOARD_BOTTOM_Y - 0.145, rawPosition.y),
    ),
  }
  const isOut =
    rawPosition.x < 0 ||
    rawPosition.x > SHEET_WIDTH ||
    rawPosition.y < BOARD_TOP_Y ||
    rawPosition.y > BOARD_BOTTOM_Y

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
}


  const handlePointerDown = (
  event: React.PointerEvent<SVGCircleElement>,
  stoneId: number,
) => {
  saveUndoState()
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
      BOARD_TOP_Y +
      ((event.clientY - rect.top) / rect.height) *
        BOARD_VIEW_HEIGHT

    const isOut =
      rawX < 0 ||
      rawX > SHEET_WIDTH ||
      rawY < BOARD_TOP_Y ||
      rawY > BOARD_BOTTOM_Y

    return {
      ...stone,
      x: Math.max(
        0.145,
        Math.min(SHEET_WIDTH - 0.145, rawX),
      ),
      y: Math.max(
        BOARD_TOP_Y,
        Math.min(BOARD_BOTTOM_Y - 0.145, rawY),
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
}

  const handleDeleteStone = () => {
    if (selectedStoneId === null) {
      return
    }

    saveUndoState()

    const latestRecord =
      throwHistory[throwHistory.length - 1]
    const isLatestRecordedStone =
      latestRecord?.endNumber === currentEnd &&
      latestRecord?.throwNumber === currentThrow - 1 &&
      latestRecord.stones.at(-1)?.id === selectedStoneId &&
      latestRecord.stones.some(
        (stone) => stone.id === selectedStoneId,
      )

    if (isLatestRecordedStone) {
      const previousRecord =
        throwHistory[throwHistory.length - 2]
      const restoredStones = previousRecord
        ? previousRecord.stones.map((stone) => ({ ...stone }))
        : []
      const deletedStone = latestRecord.stones.find(
        (stone) => stone.id === selectedStoneId,
      )

      setStones(restoredStones)
      setThrowHistory((current) => current.slice(0, -1))
      setCurrentThrow(latestRecord.throwNumber)
      setPendingStone(
        deletedStone
          ? { ...deletedStone, out: false }
          : null,
      )
      setNextStoneId(selectedStoneId)
      setSelectedHistoryThrow(null)
      setSelectedStoneId(null)
      setSelectedShotType('Guard')
      setSelectedRating(3)
      setShotNote('')
      return
    }

    setStones((current) =>
      current.filter(
        (stone) => stone.id !== selectedStoneId,
      ),
    )

    setSelectedStoneId(null)
  }

  const centerX = SHEET_WIDTH / 2
  const houseCenterY = TEE_TO_BACK
  const maxEnds = endCount
  const maxThrowsPerEnd =
    matchFormat === 'four-person' ? 16 : 10

  const totalRating = throwHistory.reduce(
    (sum, record) => sum + record.rating,
    0,
  )
  const successRate =
    throwHistory.length === 0
      ? 0
      : (totalRating / (throwHistory.length * 4)) * 100
  const shotPositions = [
    { name: 'リード', throws: [1, 2] },
    { name: 'セカンド', throws: [3, 4] },
    { name: 'サード', throws: [5, 6] },
    { name: 'フォース', throws: [7, 8] },
  ]
  const shotRateMatch = selectedShotRateMatchId
    ? savedMatches.find((match) => match.id === selectedShotRateMatchId)
    : null
  const shotRateHistory = shotRateMatch?.throwHistory ?? throwHistory
  const shotRateInitialHammer =
    shotRateMatch?.initialHammerTeam ?? initialHammerTeam
  const getShotRate = (
    team: 'self' | 'opponent',
    teamThrowNumber: number,
  ) => {
    const records = shotRateHistory.filter(
      (record) => {
        const firstTeam =
          shotRateInitialHammer === 'opponent' ? 'self' : 'opponent'
        const recordTeam =
          record.throwerTeam ??
          (record.throwNumber % 2 === 1 ? firstTeam : firstTeam === 'self' ? 'opponent' : 'self')
        const calculatedTeamThrowNumber =
          recordTeam === firstTeam
            ? Math.ceil(record.throwNumber / 2)
            : Math.ceil((record.throwNumber - 1) / 2)
        return (
          recordTeam === team &&
          calculatedTeamThrowNumber === teamThrowNumber
        )
      },
    )
    if (records.length === 0) {
      return null
    }
    return (
      (records.reduce((sum, record) => sum + record.rating, 0) /
        (records.length * 4)) *
      100
    )
  }
  const selfTeamName = teamName || (teamColor === 'red' ? '赤チーム' : '黄チーム')
  const opponentTeamName = opponentName || (teamColor === 'red' ? '黄チーム' : '赤チーム')
  const teamPlayers = playerNames.filter((name) => name.trim() !== '')
  const matchWinner =
    scoreSelf === scoreOpponent
      ? '同点'
      : scoreSelf > scoreOpponent
        ? `${selfTeamName} リード`
        : `${opponentTeamName} リード`

  const scoreColumns = Array.from({ length: maxEnds }, (_, index) => index + 1)
  const isPowerPlayEnd = (end: number) => powerPlayEnds.includes(end)
  const hasCurrentEndThrow = throwHistory.some(
    (record) => record.endNumber === currentEnd,
  )
  const canApplyPowerPlay =
          matchFormat === 'mixed-doubles' &&
          !powerPlayUsedTeams[powerPlayTeam] &&
    currentEnd < maxEnds &&
    !hasCurrentEndThrow &&
    (currentThrow === 1 || currentThrow >= maxThrowsPerEnd)

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

        {matchFormat === 'mixed-doubles' &&
          currentEnd < maxEnds &&
          !powerPlayUsedTeams[powerPlayTeam] && (
            <div style={{ marginBottom: '16px' }}>
              {!showPowerPlaySetup && (
                <button
                  onClick={handleOpenPowerPlaySetup}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #d6a900',
                    background: '#fff8d8',
                    color: '#7a5b00',
                    cursor: 'pointer',
                    fontWeight: '700',
                  }}
                >
                  この得点を確定してからPPを設定
                </button>
              )}

              {showPowerPlaySetup && (
                <div
                  style={{
                    padding: '12px',
                    border: '1px solid #e4c44a',
                    borderRadius: '10px',
                    background: '#fffdf0',
                  }}
                >
                  <strong>次のエンドのPP設定</strong>
                  <div style={{ display: 'flex', gap: '8px', margin: '8px 0', flexWrap: 'wrap' }}>
                    {(['self', 'opponent'] as const).map((team) => (
                      <button
                        key={team}
                        onClick={() => setPowerPlayTeam(team)}
                        disabled={powerPlayUsedTeams[team]}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: powerPlayTeam === team ? '2px solid #b58a00' : '1px solid #d9c77c',
                          background: powerPlayUsedTeams[team] ? '#f3f3f3' : powerPlayTeam === team ? '#fff1a8' : '#fff',
                          color: powerPlayUsedTeams[team] ? '#999' : '#222',
                        }}
                      >
                        {team === 'self' ? '自チーム' : '相手チーム'}{powerPlayUsedTeams[team] ? '（使用済み）' : ''}
                      </button>
                    ))}
                  </div>
                  <p style={{ margin: '8px 0', fontSize: '13px', color: '#665200' }}>
                    先ほどの得点を確定した後、次のエンドの置き石を左右どちら側へ移動します。
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(['left', 'right'] as const).map((side) => (
                      <button
                        key={side}
                        onClick={() => setPowerPlaySide(side)}
                        style={{
                          padding: '9px 16px',
                          borderRadius: '8px',
                          border:
                            powerPlaySide === side
                              ? '2px solid #b58a00'
                              : '1px solid #d9c77c',
                          background: powerPlaySide === side ? '#fff1a8' : '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        {side === 'left' ? '左側' : '右側'}
                      </button>
                    ))}
                    <button
                      onClick={handleApplyPowerPlay}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '8px',
                        border: '1px solid #b58a00',
                        background: '#f7d84a',
                        cursor: 'pointer',
                        fontWeight: '700',
                      }}
                    >
                      PPを適用
                    </button>
                    <button
                      onClick={() => setShowPowerPlaySetup(false)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
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
    className="scoreboard"
    style={{
      marginBottom: '12px',
      padding: '10px 12px',
      borderRadius: '8px',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
    }}
  >
    <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
      {selfTeamName} vs {opponentTeamName}
    </div>
    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
      {currentEnd}エンド　{currentThrow}投目 / 全{maxEnds}エンド
    </div>
    {teamPlayers.length > 0 && (
      <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
        選手: {teamPlayers.join(' / ')}
      </div>
    )}
  </div>

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <strong>試合設定</strong>
        <button
          onClick={() => setShowMatchSettings(false)}
          style={{
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          設定を閉じる
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
        <button
          onClick={handleSaveCurrentMatch}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #22c55e',
            background: '#ecfdf5',
            cursor: 'pointer',
          }}
        >
          試合を途中保存
        </button>
        <button
          onClick={() => {
            clearCurrentMatch()
            onResetToSetup?.()
          }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #ef4444',
            background: '#fef2f2',
            cursor: 'pointer',
          }}
        >
          リセットして最初の設定画面へ
        </button>
      </div>
      <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>
            開始するエンド
          </label>
          <select
            value={settingsStartEnd}
            onChange={(event) => setSettingsStartEnd(Number(event.target.value))}
            style={{ display: 'block', width: '100%', padding: '6px' }}
          >
            {Array.from({ length: maxEnds }, (_, index) => index + 1).map((end) => (
              <option key={end} value={end}>
                {end}エンド
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>
            開始する投目
          </label>
          <select
            value={settingsStartThrow}
            onChange={(event) => setSettingsStartThrow(Number(event.target.value))}
            style={{ display: 'block', width: '100%', padding: '6px' }}
          >
            {Array.from({ length: maxThrowsPerEnd }, (_, index) => index + 1).map((throwNumber) => (
              <option key={throwNumber} value={throwNumber}>
                {throwNumber}投目
              </option>
            ))}
          </select>
        </div>
      </div>
      {showScoreboardEdit ? (
        <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: '#fefefe', border: '1px solid #cbd5e1' }}>
          <div style={{ fontWeight: '700', marginBottom: '8px' }}>スコアボードのみ編集</div>
          <div style={{ display: 'grid', gap: '10px' }}>
            <label>
              エンド
              <select
                value={scoreboardEditEnd}
                onChange={(event) => setScoreboardEditEnd(Number(event.target.value))}
                style={{ display: 'block', width: '100%', padding: '6px', marginTop: '4px' }}
              >
                {Array.from({ length: maxEnds }, (_, index) => index + 1).map((end) => (
                  <option key={end} value={end}>
                    {end}エンド
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div style={{ marginBottom: '6px' }}>得点を取ったチーム</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['self', 'opponent'] as const).map((team) => (
                  <button
                    key={team}
                    onClick={() => setScoreboardEditTeam(team)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: scoreboardEditTeam === team ? '#eaf3ff' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {team === 'self' ? '自分' : '相手'}
                  </button>
                ))}
              </div>
            </div>
            <label>
              点数
              <select
                value={scoreboardEditPoints}
                onChange={(event) => setScoreboardEditPoints(Number(event.target.value))}
                style={{ display: 'block', width: '100%', padding: '6px', marginTop: '4px' }}
              >
                {Array.from({ length: 9 }, (_, index) => index).map((value) => (
                  <option key={value} value={value}>
                    {value}点
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={handleApplyScoreboardCorrection}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #2878d7',
                background: '#eaf3ff',
                cursor: 'pointer',
              }}
            >
              設定を保存
            </button>
            <button
              onClick={() => setShowScoreboardEdit(false)}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          <button
            onClick={() => {
              setScoreboardEditEnd(currentEnd)
              setScoreboardEditTeam('self')
              setScoreboardEditPoints(0)
              setShowScoreboardEdit(true)
            }}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #2878d7',
              background: '#eaf3ff',
              cursor: 'pointer',
            }}
          >
            スコアボードのみ編集
          </button>
          <button
            onClick={handleApplyMatchSettings}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #d97706',
              background: '#fff7ed',
              cursor: 'pointer',
            }}
          >
            指定のエンドから再開
          </button>
        </div>
      )}
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
              <button onClick={() => handleDeleteSavedMatch(match.id)}>
                この試合を削除
              </button>
              <button
                onClick={() => {
                  setSelectedShotRateMatchId(match.id)
                  setShowShotRate(true)
                }}
              >
                この試合のショット率
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setShowShotRate((current) => !current)}
        style={{
          marginTop: '14px',
          padding: '8px 12px',
          borderRadius: '7px',
          border: '1px solid #cbd5e1',
          background: '#fff',
          cursor: 'pointer',
        }}
      >
        {showShotRate ? 'ショット率を隠す' : 'ショット率を表示'}
      </button>
      {showShotRate && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '12px',
            marginTop: '10px',
            overflowX: 'auto',
          }}
        >
          {[
            { label: '自チーム', isSelf: true },
            { label: '相手チーム', isSelf: false },
          ].map(({ label, isSelf }) => (
            <table
              key={label}
              style={{
                width: '100%',
                minWidth: '280px',
                borderCollapse: 'collapse',
                fontSize: '12px',
                background: '#fff',
              }}
            >
              <caption
                style={{
                  padding: '6px',
                  border: '1px solid #cbd5e1',
                  background: isSelf ? '#eef6ff' : '#fff7ed',
                  fontWeight: '700',
                }}
              >
                {label}
              </caption>
              <thead>
                <tr>
                  {['ポジション', '1投目', '2投目', '平均'].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: '6px 4px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        textAlign: 'center',
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shotPositions.map((position) => {
                    const rates = position.throws.map((throwNumber) =>
                      getShotRate(isSelf ? 'self' : 'opponent', throwNumber),
                    )
                  const availableRates = rates.filter(
                    (rate): rate is number => rate !== null,
                  )
                  const average =
                    availableRates.length > 0
                      ? availableRates.reduce((sum, rate) => sum + rate, 0) /
                        availableRates.length
                      : null
                  return (
                    <tr key={`${label}-${position.name}`}>
                      <th
                        style={{
                          padding: '6px 4px',
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          textAlign: 'left',
                        }}
                      >
                        {position.name}
                      </th>
                      {rates.map((rate, index) => (
                        <td
                          key={`${label}-${position.name}-${index}`}
                          style={{
                            padding: '6px 4px',
                            border: '1px solid #cbd5e1',
                            textAlign: 'center',
                          }}
                        >
                          {rate === null ? '-' : `${rate.toFixed(1)}%`}
                        </td>
                      ))}
                      <td
                        style={{
                          padding: '6px 4px',
                          border: '1px solid #cbd5e1',
                          textAlign: 'center',
                          fontWeight: '700',
                        }}
                      >
                        {average === null ? '-' : `${average.toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ))}
        </div>
      )}
    </div>
  )}

  <div
    style={{
      marginBottom: '16px',
      border: '1px solid #cbd5e1',
      borderRadius: '12px',
      background: '#fff',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        padding: '10px 12px',
        fontWeight: '700',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}
    >
      エンド別スコア
    </div>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `100px repeat(${maxEnds + 2}, minmax(22px, 1fr))`,
        fontSize: '12px',
      }}
    >
      <div
        style={{
          padding: '8px 6px',
          borderRight: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          fontWeight: '700',
        }}
      />
      {scoreColumns.map((end) => (
        <div
          key={`header-${end}`}
          style={{
            padding: '8px 2px',
            textAlign: 'center',
            borderRight: '1px solid #e2e8f0',
            borderBottom: '1px solid #e2e8f0',
            background: isPowerPlayEnd(end) ? '#fff4b8' : '#f8fafc',
            fontWeight: '700',
          }}
        >
          {end}
        </div>
      ))}
      <div
        style={{
          padding: '8px 2px',
          textAlign: 'center',
          borderRight: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          fontWeight: '700',
        }}
      >
        EE
      </div>
      <div
        style={{
          padding: '8px 2px',
          textAlign: 'center',
          borderRight: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          fontWeight: '700',
        }}
      >
        合計
      </div>

      <div
        style={{
          padding: '10px 8px',
          borderRight: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          background: '#eef6ff',
          fontWeight: '700',
        }}
      >
        {selfTeamName}
      </div>
      {scoreColumns.map((end) => {
        const endResult = endResults[end - 1]
        const value = endResult
          ? endResult.result === 'blank'
            ? '0'
            : endResult.result === 'self'
              ? String(endResult.points)
              : ''
          : ''
        return (
          <div
            key={`self-${end}`}
            style={{
              minHeight: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 2px',
              borderRight: '1px solid #e2e8f0',
              borderBottom: '1px solid #e2e8f0',
              background: isPowerPlayEnd(end)
                ? '#fff4b8'
                : value
                  ? '#eaf3ff'
                  : '#fff',
              fontWeight: '700',
              color: '#1e3a8a',
            }}
          >
            {value}
          </div>
        )
      })}
      <div
        style={{
          minHeight: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 2px',
          borderRight: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          color: '#64748b',
        }}
      >
        -
      </div>
      <div
        style={{
          minHeight: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 2px',
          borderRight: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          background: '#eaf3ff',
          fontWeight: '700',
          color: '#1e3a8a',
        }}
      >
        {scoreSelf}
      </div>

      <div
        style={{
          padding: '10px 8px',
          borderRight: '1px solid #e2e8f0',
          background: '#fff7ed',
          fontWeight: '700',
        }}
      >
        {opponentTeamName}
      </div>
      {scoreColumns.map((end) => {
        const endResult = endResults[end - 1]
        const value = endResult
          ? endResult.result === 'blank'
            ? '0'
            : endResult.result === 'opponent'
              ? String(endResult.points)
              : ''
          : ''
        return (
          <div
            key={`opponent-${end}`}
            style={{
              minHeight: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 2px',
              borderRight: '1px solid #e2e8f0',
              background: isPowerPlayEnd(end)
                ? '#fff4b8'
                : value
                  ? '#fff7ed'
                  : '#fff',
              fontWeight: '700',
              color: '#9a5b00',
            }}
          >
            {value}
          </div>
        )
      })}
      <div
        style={{
          minHeight: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 2px',
          borderRight: '1px solid #e2e8f0',
          background: '#f8fafc',
          color: '#64748b',
        }}
      >
        -
      </div>
      <div
        style={{
          minHeight: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 2px',
          borderRight: '1px solid #e2e8f0',
          background: '#fff7ed',
          fontWeight: '700',
          color: '#9a5b00',
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
        className="sheet-controls"
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
{matchFormat === 'mixed-doubles' && (
  <button
    onClick={handleOpenPowerPlaySetup}
    disabled={!canApplyPowerPlay}
    style={{
      padding: '8px 16px',
      borderRadius: '8px',
      border: '1px solid #d6a900',
      background:
        !canApplyPowerPlay
          ? '#f3f3f3'
          : '#fff8d8',
      color:
        !canApplyPowerPlay
          ? '#999'
          : '#7a5b00',
      cursor:
        !canApplyPowerPlay
          ? 'default'
          : 'pointer',
    }}
  >
    {powerPlayUsed ? 'PP 2回使用済み' : 'PPを適用'}
  </button>
)}
<button
  onClick={() => {
    setSettingsStartEnd(currentEnd)
    setSettingsStartThrow(currentThrow)
    setSettingsScoreSelf(String(scoreSelf))
    setSettingsScoreOpponent(String(scoreOpponent))
    setShowMatchSettings((current) => !current)
  }}
  style={{
    marginLeft: 'auto',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
  }}
>
  設定
</button>
      </div>

      {showPowerPlaySetup && (
        <div
          style={{
            margin: '0 0 12px',
            padding: '12px',
            border: '1px solid #e4c44a',
            borderRadius: '10px',
            background: '#fffdf0',
          }}
        >
          <strong>Power Play設定</strong>
          <div style={{ display: 'flex', gap: '8px', margin: '8px 0', flexWrap: 'wrap' }}>
            {(['self', 'opponent'] as const).map((team) => (
              <button
                key={team}
                onClick={() => setPowerPlayTeam(team)}
                disabled={powerPlayUsedTeams[team]}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: powerPlayTeam === team ? '2px solid #b58a00' : '1px solid #d9c77c',
                  background: powerPlayUsedTeams[team] ? '#f3f3f3' : powerPlayTeam === team ? '#fff1a8' : '#fff',
                  color: powerPlayUsedTeams[team] ? '#999' : '#222',
                }}
              >
                {team === 'self' ? '自チーム' : '相手チーム'}{powerPlayUsedTeams[team] ? '（使用済み）' : ''}
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0', fontSize: '13px', color: '#665200' }}>
              {powerPlayUsed ? 'PP 2回使用済み' : 'PPを適用'}
            次のエンドの置き石を左右どちら側へ移動するか選択してください。PPは1試合1回のみ使用できます。
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['left', 'right'] as const).map((side) => (
              <button
                key={side}
                onClick={() => setPowerPlaySide(side)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border:
                    powerPlaySide === side
                      ? '2px solid #b58a00'
                      : '1px solid #d9c77c',
                  background: powerPlaySide === side ? '#fff1a8' : '#fff',
                  cursor: 'pointer',
                }}
              >
                {side === 'left' ? '左側' : '右側'}
              </button>
            ))}
            <button
              onClick={handleApplyPowerPlay}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #b58a00',
                background: '#f7d84a',
                cursor: 'pointer',
                fontWeight: '700',
              }}
            >
              選択した側でPPを適用
            </button>
            <button
              onClick={() => setShowPowerPlaySetup(false)}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <p
        style={{
          margin: '0 0 10px',
          fontSize: '14px',
          color: '#666',
        }}
      >
        石をタップすると選択できます。選択中の石は青い枠で表示されます。
      </p>


      <svg
        className="sheet-board"
        ref={svgRef}
        viewBox={`0 ${BOARD_TOP_Y * SCALE} ${SHEET_WIDTH * SCALE} ${BOARD_VIEW_HEIGHT * SCALE}`}
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
          y={BOARD_TOP_Y * SCALE}
          width={SHEET_WIDTH * SCALE}
          height={BOARD_VIEW_HEIGHT * SCALE}
          fill="#ffffff"
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
          y1={BOARD_TOP_Y * SCALE}
          x2={centerX * SCALE}
          y2={BOARD_BOTTOM_Y * SCALE}
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
          y1={HOG_LINE_Y * SCALE}
          x2={SHEET_WIDTH * SCALE}
          y2={HOG_LINE_Y * SCALE}
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
      {[0, 1, 2, 3, 4].map((value) => (
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

  <div style={{ marginTop: '12px' }}>
    <button
      onClick={() => {
        if (showShotPreview) {
          setShowShotPreview(false)
          setSelectedHistoryThrow(null)
          setSelectedPreviewEnd(null)
          return
        }
        setShowShotPreview(true)
      }}
      style={{
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        background: '#fff',
        cursor: 'pointer',
        fontWeight: '600',
      }}
    >
      ショットプレビュー
    </button>

      {showShotPreview && (
      <div
        style={{
          marginTop: '12px',
          padding: '12px',
          borderRadius: '8px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}
      >
        {throwHistory.length === 0 ? (
          <div style={{ color: '#777', fontSize: '14px' }}>
            まだ記録された投球はありません。
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              {Array.from(
                new Set(throwHistory.map((record) => record.endNumber)),
              )
                .sort((a, b) => a - b)
                .map((endNumber) => (
                  <button
                    key={endNumber}
                    onClick={() => {
                      const firstRecord = throwHistory.find(
                        (record) => record.endNumber === endNumber,
                      )
                      setSelectedPreviewEnd(endNumber)
                      setSelectedHistoryThrow(
                        firstRecord ? firstRecord.throwNumber : null,
                      )
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border:
                        selectedPreviewEnd === endNumber
                          ? '2px solid #2878d7'
                          : '1px solid #cbd5e1',
                      background:
                        selectedPreviewEnd === endNumber ? '#eaf3ff' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {endNumber}エンド
                  </button>
                ))}
            </div>

            {selectedPreviewEnd !== null && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                {throwHistory
                  .filter((record) => record.endNumber === selectedPreviewEnd)
                  .sort((a, b) => a.throwNumber - b.throwNumber)
                  .map((record) => (
                    <button
                      key={`${record.endNumber}-${record.throwNumber}`}
                      onClick={() => handleHistorySelect(record.endNumber, record.throwNumber)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border:
                          selectedHistoryThrow === record.throwNumber
                            ? '2px solid #2878d7'
                            : '1px solid #cbd5e1',
                        background:
                          selectedHistoryThrow === record.throwNumber ? '#eaf3ff' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {record.throwNumber}投目
                    </button>
                  ))}
              </div>
            )}

            {selectedHistoryThrow !== null &&
              (() => {
                const record = throwHistory.find(
                  (item) =>
                    item.endNumber === selectedPreviewEnd &&
                    item.throwNumber === selectedHistoryThrow,
                )

                if (!record) {
                  return null
                }

                return (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#fff',
                      border: '1px solid #cfe3ff',
                      fontSize: '14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '16px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontWeight: '700', marginBottom: '6px' }}>
                          {record.endNumber}エンド {record.throwNumber}投目
                        </div>
                        <div>ショット: {record.shotType}</div>
                        <div>評価: {record.rating}/4</div>
                        <div style={{ whiteSpace: 'pre-wrap', marginTop: '6px' }}>
                          {record.note || 'メモなし'}
                        </div>
                        <button
                          onClick={handleEditSelectedPreview}
                          style={{
                            marginTop: '10px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #2878d7',
                            background: '#eaf3ff',
                            cursor: 'pointer',
                            fontWeight: '600',
                          }}
                        >
                          修正をする
                        </button>
                      </div>

                      <div
                        style={{
                          flex: '0 1 220px',
                          width: '220px',
                          maxWidth: '100%',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#64748b',
                            marginBottom: '4px',
                          }}
                        >
                          この投球時点のハウス
                        </div>
                        <svg
                          viewBox={`0 ${BOARD_TOP_Y * SCALE} ${SHEET_WIDTH * SCALE} ${BOARD_VIEW_HEIGHT * SCALE}`}
                          width="100%"
                          role="img"
                          aria-label={`${record.endNumber}エンド ${record.throwNumber}投目のハウス`}
                          style={{
                            display: 'block',
                            aspectRatio: `${SHEET_WIDTH} / ${BOARD_VIEW_HEIGHT}`,
                            background: '#ffffff',
                            border: '1px solid #d7e2e7',
                            borderRadius: '6px',
                          }}
                        >
                          <rect
                            x="0"
                            y={BOARD_TOP_Y * SCALE}
                            width={SHEET_WIDTH * SCALE}
                            height={BOARD_VIEW_HEIGHT * SCALE}
                            fill="#ffffff"
                          />
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
                          <line
                            x1={centerX * SCALE}
                            y1={BOARD_TOP_Y * SCALE}
                            x2={centerX * SCALE}
                            y2={BOARD_BOTTOM_Y * SCALE}
                            stroke="#c8d5da"
                            strokeWidth="0.7"
                          />
                          <line
                            x1="0"
                            y1={houseCenterY * SCALE}
                            x2={SHEET_WIDTH * SCALE}
                            y2={houseCenterY * SCALE}
                            stroke="#c8d5da"
                            strokeWidth="0.7"
                          />
                          <line
                            x1="0"
                            y1="0"
                            x2={SHEET_WIDTH * SCALE}
                            y2="0"
                            stroke="#c8d5da"
                            strokeWidth="0.7"
                          />
                          <line
                            x1="0"
                            y1={HOG_LINE_Y * SCALE}
                            x2={SHEET_WIDTH * SCALE}
                            y2={HOG_LINE_Y * SCALE}
                            stroke="#aebdc3"
                            strokeWidth="1.2"
                          />
                          {record.stones
                            .filter((stone) => !stone.out)
                            .map((stone) => (
                              <circle
                                key={stone.id}
                                cx={stone.x * SCALE}
                                cy={stone.y * SCALE}
                                r="9"
                                fill={
                                  stone.color === 'red' ? '#df4b4b' : '#f2d94e'
                                }
                                stroke={
                                  stone.color === 'red' ? '#b93636' : '#c5a800'
                                }
                                strokeWidth="1.2"
                              />
                            ))}
                        </svg>
                      </div>
                    </div>
                  </div>
                )
              })()}
          </>
        )}
      </div>
    )}
    <input
      className="scroll-rail"
      type="range"
      min="0"
      max="100"
      step="0.1"
      value={scrollPosition}
      onChange={(event) => handleScrollRailChange(event.target.value)}
      aria-label="ページをスクロール"
    />
  </div>
</div>
    </div>
  )
}

export default CurlingSheet