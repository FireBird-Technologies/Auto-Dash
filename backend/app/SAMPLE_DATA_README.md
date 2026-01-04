# Sample Housing Dataset - Comprehensive Real Estate Analytics

## Overview
This enhanced sample dataset contains **500 realistic property listings** with **33 features** designed to enable comprehensive real estate market analysis and insightful dashboard creation.

## Dataset Features

### Basic Property Information (9 columns)
- **price**: Property sale price ($361K - $5.08M)
- **property_type**: Single Family, Condo, Townhouse, or Multi-Family
- **neighborhood**: Downtown, Suburbs, Waterfront, Historic District, or Business District
- **bedrooms**: Number of bedrooms (1-6)
- **bathrooms**: Number of bathrooms (1.0-4.5)
- **sqft_living**: Interior living space in square feet (800-5,500)
- **sqft_lot**: Lot size in square feet (2,000-20,000)
- **floors**: Number of floors (1.0-3.0)
- **year_built**: Year the property was built (1950-2023)

### Property Characteristics (7 columns)
- **year_renovated**: Year of last major renovation (0 if never renovated)
- **property_age**: Age of the property in years
- **waterfront**: Boolean - waterfront property (12% have this premium feature)
- **view_quality**: View rating from 0-4 (higher is better)
- **condition**: Overall condition rating 1-5
- **grade**: Construction quality grade 3-12 (7-8 is average)
- **price_segment**: Categorized as Budget, Mid-Range, Premium, or Luxury

### Amenities & Features (4 columns)
- **parking_spaces**: Number of parking spaces (0-4)
- **has_pool**: Boolean - property has a swimming pool (15%)
- **has_fireplace**: Boolean - property has fireplace(s) (35%)
- **has_basement**: Boolean - property has a basement (45%)

### Neighborhood Quality (3 columns)
- **school_rating**: School district rating (3-10, higher is better)
- **crime_index**: Neighborhood crime index (15-85, lower is better)
- **walkability_score**: Walkability score (30-100, higher is better)

### Market Metrics (3 columns)
- **price_per_sqft**: Price per square foot (calculated)
- **days_on_market**: Days the property was listed (1-180)
- **hoa_fees**: Monthly HOA fees ($0-$800, ~40% of properties)

### Temporal Data (4 columns)
- **sale_date**: Date of sale (2022-01-01 to 2024-01-01)
- **sale_month**: Month of sale (1-12)
- **sale_quarter**: Quarter of sale (Q1-Q4)
- **sale_year**: Year of sale (2022-2023)

### Location Data (3 columns)
- **zipcode**: ZIP code (10 different Seattle-area ZIP codes)
- **lat**: Latitude coordinate
- **long**: Longitude coordinate

## Key Features for Analysis

### 1. Price Drivers
The dataset includes realistic relationships between price and features:
- **Waterfront premium**: +30% average
- **View quality**: +8% per rating point
- **Property type**: Single Family and Multi-Family command premiums
- **Neighborhood**: Waterfront (+25%) and Downtown (+15%) areas are most expensive
- **School ratings**: Better schools correlate with higher prices
- **Recent renovations**: +12% for properties renovated after 2015

### 2. Market Segmentation
Properties are naturally segmented into:
- **Budget**: < $750K (25%)
- **Mid-Range**: $750K - $1.2M (30%)
- **Premium**: $1.2M - $1.8M (25%)
- **Luxury**: > $1.8M (20%)

### 3. Temporal Trends
- Sales data spans 2 years (2022-2024)
- Enables quarter-over-quarter and year-over-year analysis
- Market velocity metrics through "days_on_market"

### 4. Geographic Analysis
- 10 different ZIP codes representing diverse neighborhoods
- Lat/long coordinates for mapping and spatial analysis
- Neighborhood-level characteristics (crime, walkability, schools)

## Suggested Analysis & Visualizations

### 1. Price Distribution & Trends
- Price distribution by property type and neighborhood
- Price trends over time (quarterly/yearly)
- Price per square foot analysis

### 2. Feature Impact Analysis
- Impact of bedrooms, bathrooms on price
- Premium analysis for waterfront, pool, renovations
- School rating vs. price correlation

### 3. Market Velocity
- Days on market by price segment
- Seasonal patterns in sales activity
- HOA fees impact on marketability

### 4. Geographic Insights
- Price heatmaps by location
- Neighborhood quality metrics visualization
- ZIP code-level market analysis

### 5. Property Characteristics
- Condition vs. grade distribution
- Age distribution and renovation patterns
- Amenity combinations most common in different price ranges

### 6. Comparative Analysis
- Property type performance
- Neighborhood comparisons (crime, schools, walkability)
- Market segment characteristics

## Default Dashboard Query
The sample data comes with a pre-configured query that generates a comprehensive dashboard showcasing:
1. KPI cards for key metrics (avg price, total listings)
2. Price distribution by property type and neighborhood
3. Quarterly price trends showing market evolution
4. Feature impact analysis (bedrooms, waterfront, schools)
5. Geographic price visualization
6. Condition vs. grade matrix
7. Market velocity by price segment

## Data Quality
- **No missing values**: All records are complete
- **Realistic relationships**: Price adjustments based on actual market factors
- **Diverse distribution**: Balanced representation across categories
- **Time-series ready**: Proper date handling for temporal analysis
- **GIS-ready**: Includes coordinates for mapping

## Use Cases
This dataset is ideal for demonstrating:
- Real estate market analysis
- Predictive pricing models
- Market segmentation strategies
- Investment opportunity identification
- Neighborhood analysis and comparison
- Temporal market trend analysis
- Geographic price pattern detection

