#!/usr/bin/pwsh

# Define the help message
$helpMessage = @"

Usage: cli.ps1 --cities "city1" "city2",... [--help]
--cities: Specify one or more city names, each enclosed in quotes and separated by space.
--help: Show this help message.

Examples:
./cli.ps1 --cities "Tel-Aviv"
./cli.ps1 --cities "Tel-Aviv" "Ashdod" "Jerusalem"
./cli.ps1 --help

"@

# Function to display help and exit
function Show-Help
{
    Write-Host $helpMessage
    exit 0
}

# nothing passed in - show help
if ($args.Length -eq 0)
{
    Show-Help
}

# no --cities argument - show help
if ($args[0] -ne '--cities')
{
    Show-Help
}

# only --cities argument without actual cities - show help
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
            --env-file=.env-cluster `
            --env KAFKAJS_NO_PARTITIONER_WARNING=1 `
            --network interview-assignment_default `
            -v ./certs:/certs `
            interview-assignment-cli:latest $city
}
