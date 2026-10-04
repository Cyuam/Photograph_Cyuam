import { useState } from 'react'

export interface AnalysisResult {
  success: boolean
  analysisType: 'title' | 'subtitle' | 'complete' | 'description' | 'tags' | 'technical'
  result: string
  error?: string
  code?: string // error code
}

export function useImageAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null)

  const analyzeImage = async (
    imageUrl: string, 
    analysisType: 'title' | 'subtitle' | 'complete' | 'description' | 'tags' | 'technical' = 'description',
    customPrompt?: string
  ): Promise<AnalysisResult> => {
    setIsAnalyzing(true)
    
    try {
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          analysisType,
          ...(customPrompt && { customPrompt })
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Provide friendly error messages by code
        let userFriendlyMessage = data.details || data.error || 'Analysis failed'
        
        if (data.code === 'QUOTA_EXCEEDED') {
          userFriendlyMessage = 'AI analysis quota exhausted for today. Please try again tomorrow.'
        } else if (data.code === 'INVALID_API_KEY') {
          userFriendlyMessage = 'AI service configuration error. Please contact admin.'
        } else if (data.code === 'BAD_REQUEST') {
          userFriendlyMessage = 'Unsupported image format. Please use a different image.'
        }
        
        throw new Error(userFriendlyMessage)
      }

      setLastResult(data)
      return data
    } catch (error) {
      const errorResult: AnalysisResult = {
        success: false,
        analysisType,
        result: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'FETCH_ERROR'
      }
      setLastResult(errorResult)
      return errorResult
    } finally {
      setIsAnalyzing(false)
    }
  }

  return {
    analyzeImage,
    isAnalyzing,
    lastResult
  }
}
