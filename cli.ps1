# Define the help message
$helpMessage = @"

Usage: cli.ps1 --cities "city1","city2",... [--help]
--cities: Specify one or more city names, each enclosed in quotes and separated by commas.
--help: Show this help message.

Examples:
./cli.ps1 --cities "Tel-Aviv"
./cli.ps1 --cities "Tel-Aviv","Ashdod","Jerusalem"
./cli.ps1 --help

"@

# Function to display help and exit
function Show-Help
{
    Write-Host $helpMessage
    exit 0
}

# Check if no arguments are provided
if ($args.Length -eq 0)
{
    Show-Help
}

if ($args[0] -ne '--cities')
{
    Show-Help
}

if ($args.Length -lt 2)
{
    Show-Help
}

# Collect city names, ignoring empty strings
$cities = @()
for ($i = 1; $i -lt $args.Length; $i++) {
    $city = $args[$i].Trim()

    # City name is too short
    if ($city.length -lt 2)
    {
        continue;
    }

    # Any whitespaces not handled by Trim
    if ( [string]::IsNullOrWhiteSpace($city))
    {
        continue;
    }

    # Seems kosher
    $cities += $city
}

# Check if any kosher city names were collected
if ($cities.Count -eq 0)
{
    Show-Help
}

# Run the container for each kosher city
foreach ($city in $cities)
{
    Write-Host "Processing city: $city"
    docker run --rm `
            --env LOG_LEVEL="error" `
            --env KAFKA_BROKER="redpanda:29092" `
            --env KAFKAJS_NO_PARTITIONER_WARNING=1 `
            --network interview-assignment_default `
            interview-assignment-cli:latest $city
}