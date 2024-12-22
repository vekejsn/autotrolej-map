# Autotrolej RT map

This project attempts to utilize the data from:
    - the [Rijeka Open Data Portal](https://data.rijeka.hr/) and
    - the [Autotrolej API](https://api.autotrolej.hr/api/open/swagger/index.html)

to create a interactive map of Autotrolej services in Rijeka. A basic Kalman filter is used to predict delays in the bus schedule.

## Development
1. Clone the repository
2. Install the dependencies
    ```bash
    npm install
    ```
3. Start the development server
    ```bash
    node index.js
    ```

4. Open the browser and navigate to `http://localhost:15000/`

## Deployment
The project is currently manually deployed on a VPS.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.