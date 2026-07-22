import {
  AddRounded,
  DeleteRounded,
  NetworkCheckRounded,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useLockFn } from 'ahooks'
import { useImperativeHandle, useState, type Ref } from 'react'

import { BaseDialog, type DialogRef } from '@/components/base'
import { useVerge } from '@/hooks/use-verge'
import { cmdTestDelay } from '@/services/cmds'

type TestState = 'idle' | 'testing' | 'success' | 'failed'

type TestResult = {
  state: TestState
  delay?: number
}

const DEFAULT_TEST_LIST: IVergeTestItem[] = [
  { uid: 'apple', name: 'Apple', url: 'https://www.apple.com' },
  { uid: 'github', name: 'GitHub', url: 'https://www.github.com' },
  { uid: 'google', name: 'Google', url: 'https://www.google.com' },
  { uid: 'youtube', name: 'YouTube', url: 'https://www.youtube.com' },
]

const createUid = () =>
  crypto.randomUUID?.() ||
  `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

const validateUrl = (value: string) => {
  try {
    const parsed = new URL(normalizeUrl(value))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function WebsiteTestViewer({ ref }: { ref?: Ref<DialogRef> }) {
  const { verge, mutateVerge, patchVerge } = useVerge()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<IVergeTestItem[]>([])
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useImperativeHandle(ref, () => ({
    open: () => {
      setDraft(
        (verge?.test_list ?? DEFAULT_TEST_LIST).map((item) => ({ ...item })),
      )
      setResults({})
      setError('')
      setOpen(true)
    },
    close: () => setOpen(false),
  }))

  const updateItem = (uid: string, patch: Partial<IVergeTestItem>) => {
    setDraft((items) =>
      items.map((item) => (item.uid === uid ? { ...item, ...patch } : item)),
    )
    setResults((current) => ({ ...current, [uid]: { state: 'idle' } }))
  }

  const addItem = () => {
    const uid = createUid()
    setDraft((items) => [...items, { uid, name: '新网站', url: '' }])
    setResults((current) => ({ ...current, [uid]: { state: 'idle' } }))
  }

  const deleteItem = (uid: string) => {
    setDraft((items) => items.filter((item) => item.uid !== uid))
    setResults((current) => {
      const next = { ...current }
      delete next[uid]
      return next
    })
  }

  const runTest = async (item: IVergeTestItem) => {
    const url = normalizeUrl(item.url)
    if (!validateUrl(url)) {
      setResults((current) => ({
        ...current,
        [item.uid]: { state: 'failed' },
      }))
      return false
    }

    setResults((current) => ({
      ...current,
      [item.uid]: { state: 'testing' },
    }))
    try {
      const delay = await cmdTestDelay(url)
      const success = delay > 0
      setResults((current) => ({
        ...current,
        [item.uid]: { state: success ? 'success' : 'failed', delay },
      }))
      return success
    } catch {
      setResults((current) => ({
        ...current,
        [item.uid]: { state: 'failed' },
      }))
      return false
    }
  }

  const runAllTests = useLockFn(async () => {
    setError('')
    if (draft.length === 0) {
      setError('请先添加至少一个测试网址')
      return
    }
    const invalid = draft.find((item) => !validateUrl(item.url))
    if (invalid) {
      setError(`“${invalid.name || '未命名网站'}”的网址格式不正确`)
      return
    }
    await Promise.all(draft.map(runTest))
  })

  const save = useLockFn(async () => {
    setError('')
    const invalid = draft.find((item) => !validateUrl(item.url))
    if (invalid) {
      setError(`“${invalid.name || '未命名网站'}”的网址格式不正确`)
      return
    }

    const next = draft.map((item) => {
      const url = normalizeUrl(item.url)
      let name = item.name?.trim()
      if (!name) name = new URL(url).hostname
      return { ...item, name, url }
    })

    setSaving(true)
    try {
      mutateVerge(
        (current) => (current ? { ...current, test_list: next } : current),
        false,
      )
      await patchVerge({ test_list: next })
      setOpen(false)
    } catch {
      setError('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  })

  const resultChip = (item: IVergeTestItem) => {
    const result = results[item.uid] ?? { state: 'idle' }
    if (result.state === 'testing') {
      return <Chip size="small" label="检测中" color="info" />
    }
    if (result.state === 'success') {
      return (
        <Chip
          size="small"
          label={`已连通 · ${result.delay}ms`}
          color="success"
        />
      )
    }
    if (result.state === 'failed') {
      return <Chip size="small" label="无法连通" color="error" />
    }
    return <Chip size="small" label="未检测" variant="outlined" />
  }

  return (
    <BaseDialog
      open={open}
      title={
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <NetworkCheckRounded color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 850 }}>网站测试</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              添加常用网址，检查当前代理是否能够访问。
            </Typography>
          </Box>
          <Button size="small" startIcon={<AddRounded />} onClick={addItem}>
            添加
          </Button>
        </Stack>
      }
      contentSx={{ width: 620, maxWidth: '82vw', pt: 1.5 }}
      okBtn="保存"
      cancelBtn="取消"
      loading={saving}
      onOk={save}
      onCancel={() => setOpen(false)}
      onClose={() => setOpen(false)}
    >
      <Stack spacing={1.2}>
        {error && <Alert severity="error">{error}</Alert>}

        {draft.length === 0 && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">暂无测试网址</Typography>
          </Paper>
        )}

        {draft.map((item) => (
          <Paper
            key={item.uid}
            variant="outlined"
            sx={{ p: 1.2, borderRadius: '8px' }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ alignItems: { sm: 'center' } }}
            >
              <TextField
                size="small"
                label="名称"
                value={item.name ?? ''}
                onChange={(event) =>
                  updateItem(item.uid, { name: event.target.value })
                }
                sx={{ width: { sm: 120 } }}
              />
              <TextField
                size="small"
                label="测试网址"
                placeholder="https://www.example.com"
                value={item.url}
                onChange={(event) =>
                  updateItem(item.uid, { url: event.target.value })
                }
                sx={{ flex: 1, minWidth: 0 }}
              />
              {resultChip(item)}
              <Button
                size="small"
                variant="outlined"
                disabled={results[item.uid]?.state === 'testing'}
                onClick={() => runTest(item)}
              >
                检测
              </Button>
              <IconButton
                size="small"
                color="error"
                aria-label={`删除 ${item.name || '网站'}`}
                onClick={() => deleteItem(item.uid)}
              >
                <DeleteRounded fontSize="small" />
              </IconButton>
            </Stack>
          </Paper>
        ))}

        <Button
          variant="contained"
          startIcon={<NetworkCheckRounded />}
          onClick={runAllTests}
          disabled={draft.some(
            (item) => results[item.uid]?.state === 'testing',
          )}
        >
          全部检测
        </Button>
      </Stack>
    </BaseDialog>
  )
}
