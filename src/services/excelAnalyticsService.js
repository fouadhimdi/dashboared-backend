import * as XLSX from 'xlsx';

/**
 * Service for extracting and processing Excel data for analytics and charts
 * Optimized for performance with batch processing and web workers
 */
class ExcelAnalyticsService {
  constructor() {
    // Cache for processed data to avoid repeated calculations
    this.cache = new Map();
    // Cache timeout in milliseconds (10 minutes)
    this.cacheTimeout = 10 * 60 * 1000;
    // Track cache timestamps
    this.cacheTimestamps = new Map();
    // Maximum files to process in parallel
    this.batchSize = 2;
    // Flag to track lazy loading
    this.lazyLoadEnabled = true;
  }

  /**
   * Enable or disable lazy loading of chart data
   * @param {boolean} enabled Whether lazy loading is enabled
   */
  setLazyLoading(enabled) {
    this.lazyLoadEnabled = enabled;
  }

  /**
   * Get a cached value if available and not expired
   * @param {string} key Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  getCachedValue(key) {
    if (!this.cache.has(key)) return null;
    
    const timestamp = this.cacheTimestamps.get(key) || 0;
    const now = Date.now();
    
    if (now - timestamp > this.cacheTimeout) {
      // Cache expired
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }

  /**
   * Store a value in the cache
   * @param {string} key Cache key
   * @param {any} value Value to cache
   */
  setCachedValue(key, value) {
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Process Excel files in batches to avoid UI blocking
   * @param {Array} files Array of file paths or file objects
   * @param {Function} processBatch Function to process each batch
   * @returns {Promise} Promise resolving to combined results
   */
  async processBatchedFiles(files, processBatch) {
    if (!files || files.length === 0) {
      return [];
    }
    
    const results = [];
    // Process files in batches of batchSize
    for (let i = 0; i < files.length; i += this.batchSize) {
      const batch = files.slice(i, i + this.batchSize);
      // Process batch and wait for completion
      const batchResults = await processBatch(batch);
      results.push(...batchResults);
      
      // Allow UI to breathe if more batches remain
      if (i + this.batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }

  /**
   * Extracts time-series data from multiple Excel files with performance optimizations
   * @param {Array} files Array of file paths or file objects
   * @param {String} sheetPattern Pattern to match sheet name (e.g., 'ed kpis')
   * @param {String} columnId Excel column ID (e.g., 'AC')
   * @param {Number} rowIndex Row index to extract data from (usually consistent across files)
   * @param {Function} dataTransformer Optional function to transform the extracted value
   * @returns {Object} Object containing labels (dates), data points, and metadata
   */
  async extractTimeSeriesData(files, sheetPattern, columnId, rowIndex, dataTransformer = null) {
    if (!files || files.length === 0) {
      return { labels: [], data: [], metadata: { min: null, max: null, avg: null } };
    }
    
    // Generate cache key
    const cacheKey = `timeSeries-${files.map(f => typeof f === 'string' ? f : f.name).join(',')}-${sheetPattern}-${columnId}-${rowIndex}`;
    
    // Check cache first
    const cachedResult = this.getCachedValue(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const result = {
      labels: [],
      data: [],
      metadata: {
        min: null,
        max: null,
        avg: null,
        total: 0
      }
    };

    try {
      const fileData = await this.processBatchedFiles(files, async (batch) => {
        const batchResults = [];
        
        for (const file of batch) {
          // Extract date from filename (assuming format like XX-JD-GEN-4-YYYY-MMM-DD.xlsx)
          const fileName = typeof file === 'string' ? file : file.name;
          const dateMatch = fileName.match(/(\d{4})-([A-Z]{3})(?:-(\d{1,2}))?/);
          
          if (!dateMatch) continue;
          
          const year = dateMatch[1];
          const month = this.getMonthNumber(dateMatch[2]);
          const day = dateMatch[3] ? parseInt(dateMatch[3]) : 15; // Use 15th if day not specified
          const date = new Date(year, month - 1, day);
          
          // Process file with optimized loading
          let fileContent;
          try {
            if (typeof file === 'string') {
              const response = await fetch(`http://localhost:3001/data/${file}`);
              fileContent = await response.arrayBuffer();
            } else {
              fileContent = await file.arrayBuffer();
            }
            
            // Use optimized reading options to minimize memory usage
            const workbook = XLSX.read(new Uint8Array(fileContent), {
              type: 'array',
              cellStyles: false,
              bookSheets: true,
              cellFormula: false,
              cellNF: false
            });
            
            // Log available sheets for debugging
            console.log(`Available sheets in ${fileName}:`, workbook.SheetNames);
            
            // Find the correct sheet with case-insensitive pattern matching
            let sheetName = null;
            
            // Try the specific named sheet if specified
            if (sheetPattern === 'ED KPIs 1-6 - manual') {
              // Check if this exact sheet exists
              if (workbook.SheetNames.includes(sheetPattern)) {
                sheetName = sheetPattern;
              } else {
                // Try similar names
                sheetName = workbook.SheetNames.find(name => 
                  name.includes('KPIs') || name.includes('1-6') || name.includes('manual')
                );
              }
            }
            // First try exact match if pattern includes spaces (likely a specific sheet name)
            else if (sheetPattern.includes(' ') && !sheetName) {
              sheetName = workbook.SheetNames.find(name => 
                name === sheetPattern
              );
            }
            
            // If no exact match or pattern is generic, try partial match
            if (!sheetName) {
              sheetName = workbook.SheetNames.find(name => 
                name.toLowerCase().includes(sheetPattern.toLowerCase())
              );
            }
            
            // If still no match, try more flexible matching (just take first sheet with 'KPI' in it)
            if (!sheetName && sheetPattern.toLowerCase().includes('kpi')) {
              sheetName = workbook.SheetNames.find(name => 
                name.toLowerCase().includes('kpi')
              );
            }
            
            // If still no match, just use the first sheet as fallback
            if (!sheetName && workbook.SheetNames.length > 0) {
              sheetName = workbook.SheetNames[0];
              console.log(`Using fallback sheet "${sheetName}" for file ${fileName}`);
            }
            
            if (!sheetName) {
              console.error(`No valid worksheet found in file ${fileName}`);
              continue;
            }
            
            // Only read the specific sheet we need
            const sheet = workbook.Sheets[sheetName];
            
            // Extract the value from the specified cell
            const cellAddress = `${columnId}${rowIndex}`;
            const cell = sheet[cellAddress];
            
            if (!cell) continue;
            
            // Extract and transform the cell value
            let value = cell.v;
            
            // Apply transformation if provided
            if (dataTransformer) {
              value = dataTransformer(value, cell);
            }
            
            // Only add valid numeric values
            if (value !== null && value !== undefined && !isNaN(value)) {
              batchResults.push({
                date,
                formattedDate: this.formatDateArabic(date),
                value
              });
            }
          } catch (err) {
            console.error(`Error processing file ${fileName}:`, err);
          }
        }
        
        return batchResults;
      });
      
      // Combine results from all batches
      if (fileData.length > 0) {
        // Sort by date
        fileData.sort((a, b) => a.date - b.date);
        
        // Extract sorted data
        result.labels = fileData.map(item => item.formattedDate);
        result.data = fileData.map(item => item.value);
        
        // Calculate metadata all at once
        if (result.data.length > 0) {
          result.metadata.min = Math.min(...result.data);
          result.metadata.max = Math.max(...result.data);
          result.metadata.avg = result.data.reduce((sum, val) => sum + val, 0) / result.data.length;
          result.metadata.total = result.data.reduce((sum, val) => sum + val, 0);
        }
      }
      
      // Cache the result
      this.setCachedValue(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error extracting time series data:', error);
      return { labels: [], data: [], metadata: { min: null, max: null, avg: null, total: 0 } };
    }
  }
  
  /**
   * Extracts comparative data from a single Excel file with performance optimizations
   * @param {String|Object} file File path or file object
   * @param {String} sheetPattern Pattern to match sheet name
   * @param {Array} columnIds Array of Excel column IDs to extract
   * @param {Number} rowIndex Row index to extract data from
   * @param {Array} labels Labels for each column (if not provided, will use column IDs)
   * @param {Function} dataTransformer Optional function to transform the extracted values
   * @returns {Object} Object containing labels, data points, and metadata
   */
  async extractComparativeData(file, sheetPattern, columnIds, rowIndex, labels = null, dataTransformer = null) {
    if (!file || !columnIds || columnIds.length === 0) {
      return { labels: [], data: [], metadata: { min: null, max: null, avg: null } };
    }

    // Generate cache key
    const fileId = typeof file === 'string' ? file : file.name;
    const cacheKey = `comparative-${fileId}-${sheetPattern}-${columnIds.join(',')}-${rowIndex}`;
    
    // Check cache first
    const cachedResult = this.getCachedValue(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const result = {
      labels: labels || columnIds,
      data: [],
      metadata: {
        min: null,
        max: null,
        avg: null
      }
    };

    try {
      // Load and process the file with optimized settings
      let fileContent;
      if (typeof file === 'string') {
        const response = await fetch(`http://localhost:3001/data/${file}`);
        fileContent = await response.arrayBuffer();
      } else {
        fileContent = await file.arrayBuffer();
      }
      
      const workbook = XLSX.read(new Uint8Array(fileContent), {
        type: 'array',
        cellStyles: false,
        bookSheets: true,
        cellFormula: false,
        cellNF: false
      });
      
      // Log available sheets for debugging
      console.log(`Available sheets in ${fileId}:`, workbook.SheetNames);
      
      // Find the correct sheet with more flexible matching strategy
      let sheetName = null;
      
      // Try the specific named sheet if specified
      if (sheetPattern === 'ED KPIs 1-6 - manual') {
        // Check if this exact sheet exists
        if (workbook.SheetNames.includes(sheetPattern)) {
          sheetName = sheetPattern;
        } else {
          // Try similar names
          sheetName = workbook.SheetNames.find(name => 
            name.includes('KPIs') || name.includes('1-6') || name.includes('manual')
          );
        }
      }
      // First try exact match if pattern includes spaces (likely a specific sheet name)
      else if (sheetPattern.includes(' ') && !sheetName) {
        sheetName = workbook.SheetNames.find(name => 
          name === sheetPattern
        );
      }
      
      // If no exact match or pattern is generic, try partial match
      if (!sheetName) {
        sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes(sheetPattern.toLowerCase())
        );
      }
      
      // If still no match, try more flexible matching (just take first sheet with 'KPI' in it)
      if (!sheetName && sheetPattern.toLowerCase().includes('kpi')) {
        sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('kpi')
        );
      }
      
      // If still no match, just use the first sheet as fallback
      if (!sheetName && workbook.SheetNames.length > 0) {
        sheetName = workbook.SheetNames[0];
        console.log(`Using fallback sheet "${sheetName}" for comparative data in file ${fileId}`);
      }
      
      if (!sheetName) {
        console.error(`No valid worksheet found for comparative data in file ${fileId}`);
        return result;
      }
      
      const sheet = workbook.Sheets[sheetName];
      
      // Extract values from the specified cells
      for (const columnId of columnIds) {
        const cellAddress = `${columnId}${rowIndex}`;
        const cell = sheet[cellAddress];
        
        let value = cell ? cell.v : null;
        
        // Apply transformation if provided
        if (dataTransformer && value !== null) {
          value = dataTransformer(value, cell);
        }
        
        result.data.push(value !== null && !isNaN(value) ? value : 0);
      }
      
      // Calculate metadata
      if (result.data.length > 0) {
        const validData = result.data.filter(val => val !== null && !isNaN(val));
        if (validData.length > 0) {
          result.metadata.min = Math.min(...validData);
          result.metadata.max = Math.max(...validData);
          result.metadata.avg = validData.reduce((sum, val) => sum + val, 0) / validData.length;
        }
      }
      
      // Cache the result
      this.setCachedValue(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error extracting comparative data:', error);
      return { labels: result.labels, data: Array(result.labels.length).fill(0), metadata: { min: null, max: null, avg: null } };
    }
  }
  
  /**
   * Common data transformers for Excel cell values
   */
  transformers = {
    // Transform percentage values (either stored as decimal or with % sign)
    percentage: (value, cell) => {
      if (value === null || value === undefined) return null;
      
      if (typeof value === 'string' && value.includes('%')) {
        // Limitar a dos decimales para valores de porcentaje
        const numValue = parseFloat(value);
        return isNaN(numValue) ? null : parseFloat(numValue.toFixed(2));
      }
      
      // If it's a number less than 1, assume it's stored as decimal
      if (typeof value === 'number' && value < 1) {
        return parseFloat((value * 100).toFixed(2));
      }
      
      // También limitar a dos decimales los valores numéricos directos
      return typeof value === 'number' ? parseFloat(value.toFixed(2)) : value;
    },
    
    // Transform time values (stored as Excel time or as HH:MM string)
    timeInMinutes: (value, cell) => {
      if (value === null || value === undefined) return null;
      
      // If it's a string in format HH:MM
      if (typeof value === 'string' && value.includes(':')) {
        const [hours, minutes] = value.split(':').map(Number);
        return (hours * 60) + minutes;
      }
      
      // If it's a number (Excel stores times as fractions of 24 hours)
      if (typeof value === 'number') {
        return Math.round(value * 24 * 60); // Convert to minutes
      }
      
      return value;
    },
    
    // Transform counts/integers
    count: (value) => {
      if (value === null || value === undefined) return null;
      return Math.round(Number(value));
    }
  };
  
  /**
   * Helper method to convert month abbreviation to month number
   * @param {String} monthAbbr Month abbreviation (e.g., 'JAN')
   * @returns {Number} Month number (1-12)
   */
  getMonthNumber(monthAbbr) {
    const months = {
      'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4,
      'MAY': 5, 'JUN': 6, 'JUL': 7, 'AUG': 8,
      'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
    };
    return months[monthAbbr.toUpperCase()] || 1;
  }
  
  /**
   * Format date in Arabic format (DD Month YYYY)
   * @param {Date} date JavaScript Date object
   * @returns {String} Formatted date string
   */
  formatDateArabic(date) {
    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return `${date.getDate()} ${arabicMonths[date.getMonth()]} ${date.getFullYear()}`;
  }
  
  /**
   * Parse date from Arabic format back to Date object
   * @param {String} dateStr Formatted date string
   * @returns {Date} JavaScript Date object
   */
  parseDateFromArabic(dateStr) {
    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    const parts = dateStr.split(' ');
    if (parts.length !== 3) return new Date();
    
    const day = parseInt(parts[0]);
    const monthIndex = arabicMonths.indexOf(parts[1]);
    const year = parseInt(parts[2]);
    
    return new Date(year, monthIndex, day);
  }

  /**
   * Generate simple placeholder data when actual data loading takes too long
   * This improves initial user experience while real data loads
   * @param {Number} count Number of data points to generate
   * @param {Number} min Minimum value
   * @param {Number} max Maximum value
   * @param {Array} labels Optional array of labels
   * @returns {Object} Object with labels, data, and metadata
   */
  generatePlaceholderData(count = 6, min = 50, max = 100, labels = null) {
    const data = Array(count).fill(0).map(() => min + Math.random() * (max - min));
    
    // Generate default labels if none provided
    const defaultLabels = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
      const date = new Date(today);
      date.setMonth(today.getMonth() - (count - i - 1));
      defaultLabels.push(this.formatDateArabic(date));
    }
    
    return {
      labels: labels || defaultLabels,
      data,
      metadata: {
        min: Math.min(...data),
        max: Math.max(...data),
        avg: data.reduce((a, b) => a + b, 0) / data.length,
        total: data.reduce((a, b) => a + b, 0),
        isPlaceholder: true
      }
    };
  }
}

export const excelAnalyticsService = new ExcelAnalyticsService();