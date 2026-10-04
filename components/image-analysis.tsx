import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Sparkles, Tag, Camera, Copy, Check, Type, FileText, AlertTriangle } from 'lucide-react'
import { useImageAnalysis } from '@/hooks/use-image-analysis'
import { useI18n } from '@/lib/i18n'

interface ImageAnalysisComponentProps {
  imageUrl: string
  onResultUpdate?: (field: 'title' | 'subtitle' | 'description', result: string) => void
}

export function ImageAnalysisComponent({ imageUrl, onResultUpdate }: ImageAnalysisComponentProps) {
  const { analyzeImage, isAnalyzing } = useImageAnalysis()
  const { t } = useI18n()
  const [results, setResults] = useState<{
    title?: string
    subtitle?: string
    description?: string
    tags?: string
    technical?: string
    custom?: string
  }>({})
  const [errors, setErrors] = useState<{
    title?: string
    subtitle?: string
    description?: string
    complete?: string
    tags?: string
    technical?: string
    custom?: string
  }>({})
  const [copiedStates, setCopiedStates] = useState<{
    title?: boolean
    subtitle?: boolean
    description?: boolean
    tags?: boolean
    technical?: boolean
    custom?: boolean
  }>({})
  const [isLoading, setIsLoading] = useState<{
    title?: boolean
    subtitle?: boolean
    description?: boolean
    tags?: boolean
    technical?: boolean
    custom?: boolean
  }>({})
  const [customPrompt, setCustomPrompt] = useState('')

  // One-click generation for all fields
  const handleCompleteGeneration = async () => {
    console.log('Start one-click generation...')
    
    try {
      // Clear errors and set loading states
      setErrors(prev => ({ ...prev, complete: undefined }))
      setIsLoading(prev => ({ ...prev, title: true, subtitle: true, description: true }))
      
      // Call three APIs in parallel
      console.log('Parallel API calls for generation...')
      const [titleResult, subtitleResult, descriptionResult] = await Promise.all([
        analyzeImage(imageUrl, 'title'),
        analyzeImage(imageUrl, 'subtitle'),
        analyzeImage(imageUrl, 'description')
      ])
      
      // Check results and update state
      const updates: Record<string, string> = {}
      
      if (titleResult.success) {
        updates.title = titleResult.result
      } else {
        setErrors(prev => ({ ...prev, title: titleResult.error || t('titleGenFailed') }))
      }
      
      if (subtitleResult.success) {
        updates.subtitle = subtitleResult.result
      } else {
        setErrors(prev => ({ ...prev, subtitle: subtitleResult.error || t('subtitleGenFailed') }))
      }
      
      if (descriptionResult.success) {
        updates.description = descriptionResult.result
      } else {
        setErrors(prev => ({ ...prev, description: descriptionResult.error || t('descriptionGenFailed') }))
      }
      
      // Commit updates at once
      setResults(prev => ({ ...prev, ...updates }))
      
      // Notify parent with a slight delay
      setTimeout(() => {
        Object.entries(updates).forEach(([field, value]) => {
          if (field === 'title' || field === 'subtitle' || field === 'description') {
            console.log(`Notify update ${field}:`, value)
            onResultUpdate?.(field as 'title' | 'subtitle' | 'description', value)
          }
        })
      }, 25)
      
      console.log('One-click generation completed!')
    } catch (error) {
      console.error('One-click generation failed:', error)
      setErrors(prev => ({ ...prev, complete: t('oneClickGenFailed') }))
    } finally {
      // Clear loading flags
      setIsLoading(prev => ({ ...prev, title: false, subtitle: false, description: false }))
    }
  }

  const handleAnalyze = async (type: 'title' | 'subtitle' | 'description' | 'tags' | 'technical' | 'custom') => {
    try {
      // Clear previous error
      setErrors(prev => ({ ...prev, [type]: undefined }))
      setIsLoading(prev => ({ ...prev, [type]: true }))
      
      const result = await analyzeImage(
        imageUrl,
        type === 'custom' ? 'description' : type,
        type === 'custom' ? customPrompt : undefined,
      )
      
      if (result.success) {
        setResults(prev => ({ ...prev, [type]: result.result }))
        
        // Notify parent if a required field
        if (type === 'title' || type === 'subtitle' || type === 'description') {
          setTimeout(() => {
            console.log(`Notify single update ${type}:`, result.result)
            onResultUpdate?.(type, result.result)
          }, 25)
        }
      } else {
        setErrors(prev => ({ ...prev, [type]: result.error || t('unexpectedError') }))
      }
    } catch (error) {
      console.error(`Analysis failed: ${type}`, error)
      setErrors(prev => ({ ...prev, [type]: t('unexpectedError') }))
    } finally {
      setIsLoading(prev => ({ ...prev, [type]: false }))
    }
  }

  const copyToClipboard = async (type: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates(prev => ({ ...prev, [type]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [type]: false }))
      }, 2000)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  return (
    <div className="w-full space-y-3">
      {/* One-click generation (compact) */}
      <div className="space-y-2">
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleCompleteGeneration()
          }}
          disabled={!imageUrl || isLoading.title || isLoading.subtitle || isLoading.description}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-2 text-sm"
          size="sm"
        >
          {isLoading.title || isLoading.subtitle || isLoading.description ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              {t('generating')}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-3 w-3" />
              {t('generateAll')}
            </>
          )}
        </Button>
        
        {errors.complete && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {errors.complete}
          </div>
        )}
      </div>

      {/* Individual generation buttons (compact) */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleAnalyze('title')
          }}
          disabled={!imageUrl || isLoading.title}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          {isLoading.title ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Type className="h-3 w-3 mr-1" />
              {t('genTitle')}
            </>
          )}
        </Button>
        
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleAnalyze('subtitle')
          }}
          disabled={!imageUrl || isLoading.subtitle}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          {isLoading.subtitle ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Type className="h-3 w-3 mr-1" />
              {t('genSubtitle')}
            </>
          )}
        </Button>
        
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleAnalyze('description')
          }}
          disabled={!imageUrl || isLoading.description}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          {isLoading.description ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <FileText className="h-3 w-3 mr-1" />
              {t('genDescription')}
            </>
          )}
        </Button>
      </div>

      {/* Advanced analysis (collapsible) */}
      <details className="border border-gray-200 rounded">
        <summary className="cursor-pointer p-2 text-sm font-medium bg-gray-50 rounded hover:bg-gray-100">
          🔧 {t('advancedAnalysisTools')}
        </summary>
        <div className="p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAnalyze('tags')
              }}
              disabled={!imageUrl || isLoading.tags}
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              {isLoading.tags ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Tag className="h-3 w-3 mr-1" />
                  {t('extractTags')}
                </>
              )}
            </Button>
            
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAnalyze('technical')
              }}
              disabled={!imageUrl || isLoading.technical}
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              {isLoading.technical ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Camera className="h-3 w-3 mr-1" />
                  {t('technicalAnalysis')}
                </>
              )}
            </Button>
          </div>
          
          {/* Custom analysis */}
          <div className="space-y-1">
            <Input
              placeholder={t('customPrompt')}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="text-xs h-8"
            />
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAnalyze('custom')
              }}
              disabled={!imageUrl || !customPrompt.trim() || isLoading.custom}
              size="sm"
              className="w-full text-xs"
            >
              {isLoading.custom ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {t('analyzing')}
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  {t('runCustom')}
                </>
              )}
            </Button>
          </div>
        </div>
      </details>

      {/* Errors */}
      {(errors.title || errors.subtitle || errors.description || errors.tags || errors.technical || errors.custom) && (
        <div className="space-y-1">
          {errors.title && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">{t('title')}: {errors.title}</div>}
          {errors.subtitle && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">{t('subtitle')}: {errors.subtitle}</div>}
          {errors.description && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">{t('description')}: {errors.description}</div>}
          {errors.tags && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">{t('tags')}: {errors.tags}</div>}
          {errors.technical && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">{t('technicalAnalysis')}: {errors.technical}</div>}
          {errors.custom && <div className="text-xs text-red-600 bg-red-50 p-1 rounded">{t('customAnalysis')}: {errors.custom}</div>}
        </div>
      )}

      {/* Results (compact) */}
      {(results.title || results.subtitle || results.description || results.tags || results.technical || results.custom) && (
        <details className="border border-green-200 rounded">
          <summary className="cursor-pointer p-2 text-sm font-medium bg-green-50 rounded hover:bg-green-100">
            ✅ {t('generatedResults')} ({Object.values(results).filter(Boolean).length})
          </summary>
          <div className="p-2 space-y-2 max-h-40 overflow-y-auto">
            {results.title && (
              <div className="text-xs">
                <span className="font-medium text-blue-600">{t('title')}:</span> {results.title}
              </div>
            )}
            {results.subtitle && (
              <div className="text-xs">
                <span className="font-medium text-green-600">{t('subtitle')}:</span> {results.subtitle}
              </div>
            )}
            {results.description && (
              <div className="text-xs">
                <span className="font-medium text-purple-600">{t('description')}:</span> {results.description}
              </div>
            )}
            {results.tags && (
              <div className="text-xs">
                <span className="font-medium text-orange-600">{t('tags')}:</span> {results.tags}
              </div>
            )}
            {results.technical && (
              <div className="text-xs">
                <span className="font-medium text-red-600">{t('technicalAnalysis')}:</span> {results.technical}
              </div>
            )}
            {results.custom && (
              <div className="text-xs">
                <span className="font-medium text-gray-600">{t('customAnalysis')}:</span> {results.custom}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
