import React, { Component } from 'react';
import axios from 'axios';
import "./style.css";
import IngredientInput from './IngredientInput';
import Notifications from './Notifications';
import NotificationWrapper from './NotificationWrapper';
import { GlobalContext } from '../context/GlobalState';

class Dashboard extends Component {
    static contextType = GlobalContext;

    state = { user_name: undefined, ingredients: undefined, login: false };

    componentDidMount() {
        this.setState({ ingredients: this.context.ingredients });
        // Greet logged-in users by their Google name (ingredients still come from localStorage)
        axios.get('/profile').then((response) => {
            if (response.data && response.data.user_name) {
                this.setState({ login: true, user_name: response.data.user_name });
            }
        }).catch(() => {});
    }

    updateIngredients = () => {
        this.setState({ ingredients: this.context.ingredients });
    }

    removeIngredients = (id) => {
        this.context.deleteIngredient(id);
        this.updateIngredients();
    }

    // onClickAlert = () => {
    //     this.alert();
    // }

    render() {
        return (
            <div className="fade-in">
                <h1>{this.state.user_name ? `Welcome, ${this.state.user_name}` : 'Welcome'}</h1>
                <div className="container container-inner-color">
                    <div className="row">
                        <div className="col-md-6">
                            {/* <div className="container"> */}
                                <h2>Input your ingredients</h2>
                                <IngredientInput afterSubmit={this.updateIngredients} addIngredient={this.context.addIngredient}></IngredientInput>  
                            {/* </div> */}
                        </div>
                        <div className="col-md-6">
                            {/* <div className="container"> */}
                                <h2>Notifications</h2>
                                <NotificationWrapper>
                                    <Notifications ingredients={this.state.ingredients}></Notifications>
                                </NotificationWrapper>
                            {/* </div> */}
                        </div>
                    </div>
                </div>
                
                
                    
                {/* <div className="container border rounded"> */}


                
            </div>
        );
    }

}


export default Dashboard;